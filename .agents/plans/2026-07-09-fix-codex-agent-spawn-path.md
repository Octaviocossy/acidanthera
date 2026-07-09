# Plan: Robust external-CLI spawning (fix Codex `os error 2` + locked chat input)

> Status: **in-progress**
> Created: 2026-07-09
> Updated: 2026-07-09
> Issue: _none_

## Goal

Make the `external-CLI` agent spawn path robust so that (a) a correctly-installed engine
binary (`codex`, `claude`) is found even when the app is launched outside a login shell
(packaged macOS app / Finder / Spotlight), and (b) when a binary genuinely cannot be found or
spawned, the user sees a **clear, actionable error in the chat** and the input is **re-enabled**
— instead of a cryptic backend-only log line and a permanently disabled `ChatInput`.

## Context

### The reported failure

```
[2026-07-09][04:09:31][orbit_111_lib::agent][INFO] agent_spawn: command=codex args=["exec", "--json", "--full-auto", "Hi codex!"] cwd=/Users/ovct/Desktop/test-brain
[2026-07-09][04:09:31][orbit_111_lib::logging][ERROR] agent_spawn failed: No such file or directory (os error 2)
```

### Root-cause diagnosis (verified on this machine)

1. **The immediate cause is a broken Codex install, not app code.** `/opt/homebrew/bin/codex`
   is a **dangling symlink** → `/opt/homebrew/Caskroom/codex/0.106.0/codex-aarch64-apple-darwin`,
   but that Caskroom directory is **empty** (the binary is gone — a botched cask upgrade). So
   `which codex`, `command -v codex`, and running the symlink all fail with "no such file or
   directory". `Command::new("codex")` in Rust therefore returns `ErrorKind::NotFound` → the
   logged `os error 2`. `claude` works today only because it lives at `~/.local/bin/claude`,
   which is on the dev terminal's PATH and is a valid file.

2. **Two genuine app bugs make this failure worse than it should be, and will recur even after
   the install is fixed:**

   - **`src-tauri/src/agent.rs` — `agent_spawn`** calls `Command::new(&command)` with a bare
     name, resolved against the process's inherited PATH. Under `tauri dev` launched from a
     terminal, that PATH includes `/opt/homebrew/bin` and `~/.local/bin`. But a **packaged app
     launched from Finder/Spotlight inherits only `/usr/bin:/bin:/usr/sbin:/sbin`** — so a
     correctly-installed Homebrew/npm/cargo/`~/.local/bin` CLI won't be found. The command also
     doesn't distinguish `NotFound` from any other IO error.

   - **`src/stores/chat-store.ts` — `sendMessage`** does `await backend.start(...)` and
     `await backend.send(...)` with **no try/catch**. When `agent_spawn` returns `Err`, the
     `invoke` promise rejects; that rejection propagates out of `sendMessage` unhandled, so
     `turnActive` stays `true` forever (the chat input, disabled while `turnActive`, is locked)
     and **no error item is ever shown**. For Codex the spawn is in `send`; for Claude Code it
     is in `start` — both awaited by `sendMessage`, so a single try/catch there covers both.

### What this plan does / does not do

- **Does:** fix both app bugs — durable PATH resolution + clear "not found" error in the Rust
  backend; catch spawn failures and surface them (and re-enable input) in the chat store.
- **Does not:** repair the user's Codex install — that is an environment action
  (`brew reinstall codex`, or reinstall via the official installer). The code fix will make the
  broken state produce a clear, correct error; repairing the install is required to exercise the
  Codex **happy path** (see Open Questions).

### Constraints

- Follow the domain glossary (`.agents/ubiquitous-language.md`): the chat consumes only
  `AgentEvent`/`ChatItem`; `agentProcessService` and `agent.rs` stay **engine-agnostic** — no
  Codex/Claude-specific branching in the spawn path. The fix is generic to all `external-CLI`
  backends.
- Keep the Rust backend **dependency-free** for this change (the crate list in `Cargo.toml` is
  deliberately minimal). Use `std` only — no `which`/`fix-path-env` crate (see Architecture
  Decisions for why).
- macOS is the target dev/runtime platform; keep the code compiling on non-unix but do not
  invest in Windows PATH semantics here.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src-tauri/src/agent.rs` | Add a `CommandNotFound` error variant; resolve the command to an absolute executable against an augmented PATH before spawning; pass an augmented `PATH` env to the child so its own sub-tools resolve too. |
| MODIFY | `src/stores/chat-store.ts` | Wrap `backend.start`/`backend.send` in try/catch inside `sendMessage`; on failure push a `{ kind: 'error' }` item and set `turnActive: false`. |
| MODIFY | `.agents/ubiquitous-language.md` | Document the new `CommandNotFound` error state + the command-resolution behavior; bump "Last updated"; add a Changelog row. |

## Step-by-Step Implementation

Implement in order. Steps 1–3 are the Rust backend; Step 4 is the frontend safety net (each is
independently valuable); Step 5 is the glossary; Step 6 is validation.

---

> **Step 1 — Add a `CommandNotFound` error variant to `AgentProcessError`**
>
> - **File:** `src-tauri/src/agent.rs`
> - **Action:** MODIFY
> - **Details:**
>   - In the existing `AgentProcessError` enum (currently `NotRunning` + `Io(#[from] std::io::Error)`),
>     add a third variant carrying the command name, with an actionable `#[error(...)]` message.
>     The enum already serializes to the frontend via its `Display` string (see the existing
>     `impl Serialize`), so this message is exactly what the chat will show.
>
>     ```rust
>     #[derive(Debug, Error)]
>     pub enum AgentProcessError {
>         #[error("no agent process is running")]
>         NotRunning,
>         #[error("`{command}` was not found. Install it and make sure it is on your PATH (also checked /opt/homebrew/bin, /usr/local/bin, ~/.local/bin, ~/.cargo/bin).")]
>         CommandNotFound { command: String },
>         #[error(transparent)]
>         Io(#[from] std::io::Error),
>     }
>     ```
> - **Why:** Gives the user a specific, fixable message ("codex was not found …") instead of the
>   opaque "No such file or directory (os error 2)", and lets the spawn path branch on
>   not-found vs. other IO errors.

---

> **Step 2 — Add std-only command-resolution helpers**
>
> - **File:** `src-tauri/src/agent.rs`
> - **Action:** MODIFY (add free functions near the top, after the imports / before `agent_spawn`)
> - **Details:**
>   - Extend the `use std::` block with the paths needed:
>
>     ```rust
>     use std::{
>         env,
>         ffi::OsString,
>         io::{BufRead, BufReader, Write},
>         path::{Path, PathBuf},
>         process::{Child, ChildStdin, Command, Stdio},
>         sync::Mutex,
>     };
>     ```
>   - Add the helpers below. `extra_path_dirs()` lists directories a GUI-launched macOS app's
>     minimal inherited PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) would miss. `is_executable_file()`
>     uses `std::fs::metadata` which **follows symlinks**, so the **dangling `codex` symlink
>     resolves to `Err` → treated as not present** — exactly the behavior we want.
>
>     ```rust
>     /// Directories that commonly hold user-installed CLIs but are absent from the minimal PATH a
>     /// GUI-launched (Finder/Spotlight) macOS app inherits. `$HOME`-relative entries expand at call
>     /// time. Order is best-effort; the inherited PATH is always searched first (see `resolve_command`).
>     fn extra_path_dirs() -> Vec<PathBuf> {
>         let mut dirs = vec![
>             PathBuf::from("/opt/homebrew/bin"),
>             PathBuf::from("/opt/homebrew/sbin"),
>             PathBuf::from("/usr/local/bin"),
>         ];
>         if let Some(home) = env::var_os("HOME") {
>             let home = PathBuf::from(home);
>             for rel in [".local/bin", ".cargo/bin", ".bun/bin", ".npm-global/bin", ".volta/bin"] {
>                 dirs.push(home.join(rel));
>             }
>         }
>         dirs
>     }
>
>     /// True if `path` is an existing, executable regular file. `metadata` follows symlinks, so a
>     /// dangling symlink (e.g. a broken Homebrew cask) is correctly reported as not executable.
>     fn is_executable_file(path: &Path) -> bool {
>         match std::fs::metadata(path) {
>             Ok(md) if md.is_file() => {
>                 #[cfg(unix)]
>                 {
>                     use std::os::unix::fs::PermissionsExt;
>                     md.permissions().mode() & 0o111 != 0
>                 }
>                 #[cfg(not(unix))]
>                 {
>                     true
>                 }
>             }
>             _ => false,
>         }
>     }
>
>     /// Resolves a bare `command` name to an absolute executable path, searching the inherited
>     /// PATH first, then `extra_path_dirs()`. A `command` that already contains a path separator is
>     /// returned unchanged (the caller/`Command` handles it). Returns `None` if nothing matches.
>     fn resolve_command(command: &str) -> Option<PathBuf> {
>         if command.contains('/') {
>             return Some(PathBuf::from(command));
>         }
>         let inherited: Vec<PathBuf> = env::var_os("PATH")
>             .map(|p| env::split_paths(&p).collect())
>             .unwrap_or_default();
>         inherited
>             .into_iter()
>             .chain(extra_path_dirs())
>             .map(|dir| dir.join(command))
>             .find(|candidate| is_executable_file(candidate))
>     }
>
>     /// The inherited PATH with `extra_path_dirs()` appended (deduped), for the spawned child's env
>     /// so the engine's own sub-tools (node, git, …) also resolve under a minimal GUI PATH.
>     fn augmented_path() -> OsString {
>         let inherited = env::var_os("PATH").unwrap_or_default();
>         let mut dirs: Vec<PathBuf> = env::split_paths(&inherited).collect();
>         for dir in extra_path_dirs() {
>             if !dirs.contains(&dir) {
>                 dirs.push(dir);
>             }
>         }
>         env::join_paths(dirs).unwrap_or(inherited)
>     }
>     ```
> - **Why:** Deterministically finds correctly-installed CLIs regardless of how the app was
>   launched, and — because `metadata` follows symlinks — treats the broken Codex symlink as
>   "not found" so Step 3 can report it cleanly.

---

> **Step 3 — Rewire `agent_spawn` to resolve the command and augment the child's PATH**
>
> - **File:** `src-tauri/src/agent.rs`
> - **Action:** MODIFY (inside the existing `agent_spawn` closure)
> - **Details:**
>   - Replace the current `let mut child = Command::new(&command) … .spawn()?;` block. Resolve
>     first (returning `CommandNotFound` when nothing matches), spawn the **resolved absolute
>     path** with an augmented `PATH` env, and defensively remap a late `NotFound` from `spawn()`
>     itself to `CommandNotFound`:
>
>     ```rust
>     (|| {
>         stop_running(&state);
>
>         let resolved = resolve_command(&command)
>             .ok_or_else(|| AgentProcessError::CommandNotFound { command: command.clone() })?;
>
>         let mut child = Command::new(&resolved)
>             .args(&args)
>             .current_dir(&cwd)
>             .env("PATH", augmented_path())
>             .stdin(Stdio::piped())
>             .stdout(Stdio::piped())
>             .stderr(Stdio::piped())
>             .spawn()
>             .map_err(|e| match e.kind() {
>                 std::io::ErrorKind::NotFound => {
>                     AgentProcessError::CommandNotFound { command: command.clone() }
>                 }
>                 _ => AgentProcessError::Io(e),
>             })?;
>
>         let stdin = child.stdin.take().expect("stdin was requested as piped");
>         let stdout = child.stdout.take().expect("stdout was requested as piped");
>         let stderr = child.stderr.take().expect("stderr was requested as piped");
>
>         spawn_line_reader(app.clone(), stdout, "agent-stdout", true);
>         spawn_line_reader(app, stderr, "agent-stderr", false);
>
>         *lock(&state) = Some(RunningAgent { child, stdin });
>         Ok(())
>     })()
>     .log_err("agent_spawn")
>     ```
>   - Keep the existing `log::info!("agent_spawn: command={command} args={args:?} cwd={cwd}");`
>     line above the closure unchanged. Consider adding, right after resolution succeeds, a
>     debug/info line noting the resolved path — optional:
>     `log::info!("agent_spawn: resolved {command} -> {}", resolved.display());`
> - **Why:** The engine is now found when installed (even under a minimal GUI PATH), the child
>   inherits a usable PATH for its own sub-tools, and a genuine miss surfaces as the actionable
>   `CommandNotFound` (serialized to the frontend + logged via the existing `.log_err`).

---

> **Step 4 — Catch spawn failures in the chat store and surface them**
>
> - **File:** `src/stores/chat-store.ts`
> - **Action:** MODIFY (the `sendMessage` action)
> - **Details:**
>   - Wrap the `start`/`send` sequence in try/catch. On any rejection, append an `error`
>     `ChatItem` with the backend's message and clear `turnActive` so `ChatInput` re-enables.
>     Note: Tauri `invoke` rejects with the **serialized error string** (not an `Error`
>     instance), so read the message defensively. The existing `nextId('error')` helper and the
>     `{ kind: 'error', … }` shape are already used a few lines above (the vault-not-open guard),
>     so this matches existing style.
>   - Replace the tail of `sendMessage` (from the `if (!get().sessionStarted)` block through the
>     final `await backend.send(trimmed);`) with:
>
>     ```ts
>     try {
>       if (!get().sessionStarted) {
>         const vaultRoot = useAppStore.getState().vaultRoot;
>         if (!vaultRoot) {
>           set((state) => ({
>             items: [...state.items, { kind: 'error', id: nextId('error'), message: 'Open a vault before starting a chat.' }],
>             turnActive: false,
>           }));
>           return;
>         }
>         await backend.start(vaultRoot, (event) => set((state) => applyAgentEvent(state, event)));
>         set({ sessionStarted: true });
>       }
>
>       await backend.send(trimmed);
>     } catch (err) {
>       const message = err instanceof Error ? err.message : String(err);
>       set((state) => ({
>         items: [...state.items, { kind: 'error', id: nextId('error'), message: `Could not start the agent: ${message}` }],
>         turnActive: false,
>       }));
>     }
>     ```
>   - Leave the earlier lines of `sendMessage` (the `trimmed`/`turnActive` guard, the
>     `getBackend` lookup, and the user-message push) unchanged.
> - **Why:** This is the actual user-facing bug fix: a spawn rejection (Codex `CommandNotFound`,
>   Claude Code the same, or any IO error) now shows an actionable chat error and unlocks the
>   input, instead of silently locking the UI forever. It is engine-agnostic and covers both the
>   `start`-time (Claude Code) and `send`-time (Codex) spawn.
> - **Note (pre-existing, out of scope):** `createClaudeCodeBackend.start` registers its stdout/exit
>   listeners *before* awaiting the spawn, so a failed start leaves those listeners registered and
>   a retry double-registers them (minor leak). Not fixed here to keep scope tight; see Open
>   Questions.

---

> **Step 5 — Update the domain glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:**
>   - Bump the `> **Last updated**` line to `2026-07-09 (Robust external-CLI spawn / command resolution)`.
>   - In the `AgentProcessState` row's notes (or a short addition to the `agentProcessService`
>     row), note that `agent_spawn` now resolves the command to an absolute executable against an
>     augmented PATH (inherited + common macOS user bin dirs) and returns a `CommandNotFound`
>     error when the engine binary is missing.
>   - Add a Changelog row:
>
>     | Date | Change | Reason |
>     |------|--------|--------|
>     | 2026-07-09 | `agent_spawn` command resolution + `CommandNotFound`; chat surfaces spawn failures | Fix Codex `os error 2` (broken install) UX and make GUI-launched apps find installed engines |
> - **Why:** The rule requires the glossary to track new states/processes; `CommandNotFound` is a
>   new backend error state and command resolution is a new process in the spawn path.

---

> **Step 6 — Validate (see Validation Criteria for the full checklist)**
>
> - **File:** _n/a_
> - **Action:** run the build/lint/type-check + manual smoke tests.

## Architecture Decisions

- **std-only resolver, not the `which` crate.** `Cargo.toml` is deliberately minimal and the
  codebase hand-rolls small utilities (per the glossary). The `which` crate would still only
  search the *current* PATH, so we'd have to augment PATH first anyway — at which point the
  ~30-line std resolver is simpler and dependency-free. Trade-off: we own a small amount of
  path logic; acceptable.
- **Explicit `extra_path_dirs()` instead of querying the login shell's PATH.** The most
  "complete" macOS fix is to run `$SHELL -lic 'echo $PATH'` once at startup (what the
  `fix-path-env` crate does) and adopt it. Rejected as primary: spawning a login shell is
  slow, can be blocked/sandboxed, and varies per user config. A curated, deterministic set of
  well-known dirs (Homebrew, `/usr/local`, `~/.local`, cargo, bun, npm-global, volta) covers the
  real install locations for `codex`/`claude` without a subprocess. Documented here as the
  alternative if a user reports an unusual install prefix.
- **`metadata` (follows symlinks), not `symlink_metadata`.** We *want* the dangling-symlink
  Codex install to be treated as "not present" so it falls through to `CommandNotFound`, rather
  than resolving to a symlink whose target is missing and failing later with the opaque IO error.
- **Augment the child's `PATH` env, not just resolve the command.** Even with an absolute path to
  the engine, the engine itself may shell out to `node`/`git`/etc. Setting the child's `PATH`
  keeps those resolvable under a minimal GUI PATH.
- **Single try/catch in `sendMessage` rather than per-backend try/catch.** `sendMessage` is the
  one place that awaits both `start` and `send` for every engine, so one guard there is DRY and
  engine-agnostic — consistent with the existing inline `error` `ChatItem` push for the
  vault-not-open case. It does not violate the "only `AgentEvent` leaves the adapter" rule
  because the failure originates at the `invoke` boundary (a rejected promise), not inside an
  adapter's stream translation.

## Validation Criteria

- [x] `cd src-tauri && cargo check` passes (Rust compiles; new variant/helpers type-check).
- [x] `pnpm lint` passes (Biome — chat-store change is clean).
- [x] `pnpm build` passes (tsc + Vite — no type errors in `chat-store.ts`).
- [x] **Resolver logic verified against real filesystem state:** compiled a standalone copy of
      `resolve_command`/`is_executable_file`/`extra_path_dirs` and ran it under a simulated
      minimal GUI PATH (`/usr/bin:/bin:/usr/sbin:/sbin`). Result: `resolve_command("codex")` →
      `None` (the dangling `/opt/homebrew/bin/codex` symlink is correctly treated as absent) and
      `resolve_command("claude")` → `Some("/Users/ovct/.local/bin/claude")` (found via
      `extra_path_dirs()` even though `~/.local/bin` isn't in the minimal PATH). This confirms the
      exact behavior Steps 2–3 depend on.
- [x] **App boots cleanly:** `pnpm tauri dev` launched, backend logged `orbit-111 backend
      started`, window renders the expected fresh-boot state (scratch buffer, "Open vault…").
      Screenshot taken and reviewed.
- [ ] **Manual — not-found path (works today, no reinstall needed):** run `pnpm dev`, open the
      `test-brain` vault, select **Codex**, send "Hi codex!". Expect: a chat **error** item
      reading roughly "Could not start the agent: `codex` was not found. Install it and make sure
      it is on your PATH …", and the **input re-enabled** (not stuck). Backend log shows
      `agent_spawn failed: `codex` was not found …` (no longer the raw `os error 2`).
      **Not yet run interactively** — this session has no OS-level accessibility permission to
      script clicks into the native window, so this step needs a manual click-through (app is
      left running from this session for that purpose).
- [ ] **Manual — Claude Code regression:** select **Claude Code**, send a message; the turn
      streams normally (resolution finds `~/.local/bin/claude`). Same caveat as above.
- [ ] **Manual — Codex happy path (requires install repair, see Open Questions):** after
      `brew reinstall codex` (or reinstalling so `/opt/homebrew/bin/codex` is a valid
      executable), selecting Codex and sending a message starts a real turn.

## Open Questions

- **Codex install must be repaired to test the happy path.** On this machine
  `/opt/homebrew/bin/codex` is a dangling symlink (empty Caskroom dir), so Codex cannot run
  regardless of app code. The code fix is validated by the *not-found* path above; exercising the
  *success* path requires the user to reinstall Codex (`brew reinstall codex`, or the official
  installer). Not a code blocker — flagging so happy-path validation isn't mistaken for a
  regression.
- **Claude Code `start` listener double-registration on retry** (noted in Step 4) is a minor
  pre-existing leak left out of scope. Fold into this change or a follow-up? Default: leave as-is.
- **Windows support** for the resolver is intentionally minimal (no PATHEXT handling). Confirm
  macOS-only is acceptable for now (consistent with the rest of the app's dev setup).
