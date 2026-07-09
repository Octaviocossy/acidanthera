# Plan: Rust Backend File Logger

> Status: **completed**
> Created: 2026-07-08
> Updated: 2026-07-08
> Issue: _none_

## Goal

Add a small backend logging utility, built on `tauri-plugin-log`, that appends timestamped,
leveled lines to a local file (`logs/orbit-111.log`), and wire an entry-log + error-log into
every Tauri command ("use case") so backend activity and failures are recorded to disk.

## Context

- **Current state:** The Rust backend (`src-tauri/src/`) has **no logging at all**. Errors are
  serialized to strings and returned to the frontend (`AgentProcessError`/`VaultError` implement
  `Serialize`), but nothing is ever written backend-side. There is no way to inspect what a
  command did or why it failed after the fact.
- **The seven "use cases"** are the `#[tauri::command]` functions registered in
  `src-tauri/src/lib.rs`:
  - `vault.rs`: `pick_vault` (async), `read_vault_tree`, `read_note`, `write_note`
  - `agent.rs`: `agent_spawn`, `agent_send`, `agent_stop`
- **Decisions already made (with the user):**
  - Foundation: **`tauri-plugin-log`** (official Tauri 2 plugin) + the `log` crate facade — not a
    fully hand-rolled logger, not `tracing`.
  - Destination: a **local file** at **`./logs/orbit-111.log`** (relative to the app's working
    directory). Stdout is added too for dev convenience.
- **Constraints / gotchas the implementer must know:**
  - The module file **must not** be named `log.rs` — a crate-root module named `log` would shadow
    the external `log` crate and make `log::info!` ambiguous. Name it **`logging.rs`**.
  - The `TargetKind::Folder { path }` is resolved **relative to the process working directory**.
    Under `pnpm tauri dev` that directory is `src-tauri/`, so the file appears at
    `src-tauri/logs/orbit-111.log`. That path is already covered by the root `.gitignore`
    (`logs` and `*.log` patterns) — **no `.gitignore` edit is required**.
  - Backend-only logging needs **no capability/permission change**. The plugin's permissions only
    gate webview→plugin command calls (`attachConsole`, JS `log`), which we do not use.
  - `pnpm build` compiles the **frontend only**. Rust must be validated with `cargo` inside
    `src-tauri/` (or `pnpm tauri dev`).
  - `agent_send` receives the raw user prompt — log its **byte count**, not its content, to avoid
    writing user text to disk.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src-tauri/Cargo.toml` | Add `log` + `tauri-plugin-log` dependencies |
| CREATE | `src-tauri/src/logging.rs` | The logging utility: configured plugin builder + `LogResult` error-logging extension trait |
| MODIFY | `src-tauri/src/lib.rs` | Declare `mod logging`, register `logging::plugin()`, add a startup log via `.setup` |
| MODIFY | `src-tauri/src/vault.rs` | Add entry-log + `.log_err(..)` to `pick_vault`, `read_vault_tree`, `read_note`, `write_note` |
| MODIFY | `src-tauri/src/agent.rs` | Add entry-log + `.log_err(..)` to `agent_spawn`, `agent_send`; entry-log for `agent_stop` |
| MODIFY | `.agents/ubiquitous-language.md` | Add glossary entry for the logging utility; bump "Last updated" + changelog |

No `.gitignore` change (already covered). No capabilities change.

## Step-by-Step Implementation

### Step 1 — Add the dependencies

- **File:** `src-tauri/Cargo.toml`
- **Action:** MODIFY
- **Details:** Under `[dependencies]`, add (keep the existing entries; append these two):
  ```toml
  log = "0.4"
  tauri-plugin-log = "2"
  ```
  `tauri-plugin-log` is versioned `"2"` to match the other Tauri v2 plugins already present
  (`tauri`, `tauri-plugin-opener`, `tauri-plugin-dialog`). The `log` crate provides the
  `log::info!` / `log::warn!` / `log::error!` macros used throughout the commands.
- **Why:** The utility is a thin wrapper over these two crates; both must be declared before use.

### Step 2 — Create the logging utility module

- **File:** `src-tauri/src/logging.rs`
- **Action:** CREATE
- **Details:** Create the file with exactly this content:
  ```rust
  //! Backend logging utility, used by every Tauri command ("use case"). Wraps `tauri-plugin-log`,
  //! configuring it to append structured, timestamped, leveled lines to a local file at
  //! `logs/orbit-111.log` (relative to the app's working directory — `src-tauri/` under
  //! `tauri dev`) and to stdout during development. Each command logs an INFO line on entry and,
  //! through the `LogResult` extension trait, an ERROR line on every failure path.

  use std::{fmt::Display, path::PathBuf};

  use log::LevelFilter;
  use tauri::{plugin::TauriPlugin, Runtime};
  use tauri_plugin_log::{Builder, Target, TargetKind};

  /// The lib/crate name, used as the `level_for` target so our own logs pass at INFO while noisy
  /// dependencies (tauri, notify, …) are held to WARN. Must match `[lib] name` in `Cargo.toml`.
  const CRATE_TARGET: &str = "orbit_111_lib";

  /// Builds the configured `tauri-plugin-log` plugin. Register it **first** in the Tauri builder
  /// so it captures every subsequent plugin's logs.
  ///
  /// - Appends to `logs/orbit-111.log` (the plugin adds the `.log` extension) and to stdout.
  /// - Global level WARN; our own crate at INFO via `level_for(CRATE_TARGET, …)`.
  pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
      Builder::new()
          .clear_targets()
          .target(Target::new(TargetKind::Folder {
              path: PathBuf::from("logs"),
              file_name: Some("orbit-111".into()),
          }))
          .target(Target::new(TargetKind::Stdout))
          .level(LevelFilter::Warn)
          .level_for(CRATE_TARGET, LevelFilter::Info)
          .build()
  }

  /// Extension on `Result` that logs the `Err` variant (if any) at ERROR level, prefixed with the
  /// caller-supplied command name, then returns the result unchanged — so it drops straight into a
  /// Tauri command's return position. `T` is unconstrained; `E` only needs `Display` (both backend
  /// error enums implement it through `thiserror`).
  pub trait LogResult {
      fn log_err(self, command: &str) -> Self;
  }

  impl<T, E: Display> LogResult for Result<T, E> {
      fn log_err(self, command: &str) -> Self {
          if let Err(err) = &self {
              log::error!("{command} failed: {err}");
          }
          self
      }
  }
  ```
- **Why:** Centralizes the one-time plugin configuration (the "utility") and exposes a single
  ergonomic call (`.log_err("<command>")`) that each use case chains onto its result, so error
  logging is uniform and adds one line per command. `clear_targets()` drops the plugin's default
  targets (which include the OS log dir and webview) so output goes only to the file + stdout we
  chose. The WARN-global / INFO-for-our-crate split keeps the file readable — `level_for` matches
  by target prefix, and every module in this lib reports under an `orbit_111_lib::*` target.

### Step 3 — Register the plugin and log startup in `lib.rs`

- **File:** `src-tauri/src/lib.rs`
- **Action:** MODIFY
- **Details:** Replace the entire file body with:
  ```rust
  mod agent;
  mod logging;
  mod vault;

  use agent::AgentProcessState;
  use vault::VaultState;

  #[cfg_attr(mobile, tauri::mobile_entry_point)]
  pub fn run() {
      tauri::Builder::default()
          .plugin(logging::plugin())
          .plugin(tauri_plugin_opener::init())
          .plugin(tauri_plugin_dialog::init())
          .manage(VaultState::default())
          .manage(AgentProcessState::default())
          .setup(|_app| {
              log::info!("orbit-111 backend started");
              Ok(())
          })
          .invoke_handler(tauri::generate_handler![
              vault::pick_vault,
              vault::read_vault_tree,
              vault::read_note,
              vault::write_note,
              agent::agent_spawn,
              agent::agent_send,
              agent::agent_stop,
          ])
          .run(tauri::generate_context!())
          .expect("error while running tauri application");
  }
  ```
  Changes vs. current: add `mod logging;` (alphabetical, between `agent` and `vault`); add
  `.plugin(logging::plugin())` as the **first** plugin; add the `.setup(..)` hook that emits one
  startup INFO line. Everything else is unchanged.
- **Why:** The plugin must be registered for any `log::*` call to be captured; registering it first
  means later plugins' logs are captured too. The `.setup` runs after plugins initialize, so the
  logger is ready — the startup line is a smoke-test that the file is being written.

### Step 4 — Instrument the vault commands

- **File:** `src-tauri/src/vault.rs`
- **Action:** MODIFY
- **Details:**
  1. Add the import near the other `use` statements at the top of the file:
     ```rust
     use crate::logging::LogResult;
     ```
  2. Rewrite each command to log an INFO entry line, wrap its fallible body in an immediately
     -invoked closure (so **every** `?` early-return is still caught), and chain `.log_err(..)`:

     **`pick_vault`** (async — use an `async { … }.await` block):
     ```rust
     #[tauri::command]
     pub async fn pick_vault(app: AppHandle, state: State<'_, VaultState>) -> VaultResult<String> {
         log::info!("pick_vault: opening folder picker");
         async {
             let folder = app.dialog().file().blocking_pick_folder();
             let root = folder
                 .ok_or(VaultError::NoFolderSelected)?
                 .into_path()
                 .map_err(|_| VaultError::InvalidPath)?;
             watch(&app, &state, root.clone())?;
             log::info!("pick_vault: adopted vault root {}", root.display());
             Ok(root.to_string_lossy().into_owned())
         }
         .await
         .log_err("pick_vault")
     }
     ```

     **`read_vault_tree`:**
     ```rust
     #[tauri::command]
     pub fn read_vault_tree(state: State<'_, VaultState>) -> VaultResult<Vec<VaultEntry>> {
         log::info!("read_vault_tree");
         (|| build_tree(&current_root(&state)?))().log_err("read_vault_tree")
     }
     ```

     **`read_note`:**
     ```rust
     #[tauri::command]
     pub fn read_note(path: String, state: State<'_, VaultState>) -> VaultResult<String> {
         log::info!("read_note: path={path}");
         (|| {
             let root = current_root(&state)?;
             Ok(fs::read_to_string(guarded_path(&root, &path)?)?)
         })()
         .log_err("read_note")
     }
     ```

     **`write_note`** (log byte count, not `contents`):
     ```rust
     #[tauri::command]
     pub fn write_note(path: String, contents: String, state: State<'_, VaultState>) -> VaultResult<()> {
         log::info!("write_note: path={path} bytes={}", contents.len());
         (|| {
             let root = current_root(&state)?;
             fs::write(guarded_path(&root, &path)?, contents)?;
             Ok(())
         })()
         .log_err("write_note")
     }
     ```
- **Why:** The IIFE (`(|| { … })()`) turns a multi-`?` body into a single `Result` expression the
  `.log_err` extension can inspect, without restructuring the existing logic or losing early
  returns. Entry logs capture the key argument (path); `.log_err` records any failure with the
  command name.

### Step 5 — Instrument the agent commands

- **File:** `src-tauri/src/agent.rs`
- **Action:** MODIFY
- **Details:**
  1. Add near the top `use` statements:
     ```rust
     use crate::logging::LogResult;
     ```
  2. Rewrite the commands:

     **`agent_spawn`:**
     ```rust
     #[tauri::command]
     pub fn agent_spawn(
         command: String,
         args: Vec<String>,
         cwd: String,
         app: AppHandle,
         state: State<'_, AgentProcessState>,
     ) -> AgentProcessResult<()> {
         log::info!("agent_spawn: command={command} args={args:?} cwd={cwd}");
         (|| {
             stop_running(&state);

             let mut child = Command::new(&command)
                 .args(&args)
                 .current_dir(&cwd)
                 .stdin(Stdio::piped())
                 .stdout(Stdio::piped())
                 .stderr(Stdio::piped())
                 .spawn()?;

             let stdin = child.stdin.take().expect("stdin was requested as piped");
             let stdout = child.stdout.take().expect("stdout was requested as piped");
             let stderr = child.stderr.take().expect("stderr was requested as piped");

             spawn_line_reader(app.clone(), stdout, "agent-stdout", true);
             spawn_line_reader(app, stderr, "agent-stderr", false);

             *lock(&state) = Some(RunningAgent { child, stdin });
             Ok(())
         })()
         .log_err("agent_spawn")
     }
     ```

     **`agent_send`** (log byte count, not `input`):
     ```rust
     #[tauri::command]
     pub fn agent_send(input: String, state: State<'_, AgentProcessState>) -> AgentProcessResult<()> {
         log::info!("agent_send: {} bytes", input.len());
         (|| {
             let mut guard = lock(&state);
             let running = guard.as_mut().ok_or(AgentProcessError::NotRunning)?;
             writeln!(running.stdin, "{input}")?;
             running.stdin.flush()?;
             Ok(())
         })()
         .log_err("agent_send")
     }
     ```

     **`agent_stop`** (never returns `Err` today, so entry-log only — no `.log_err` needed):
     ```rust
     #[tauri::command]
     pub fn agent_stop(state: State<'_, AgentProcessState>) -> AgentProcessResult<()> {
         log::info!("agent_stop");
         stop_running(&state);
         Ok(())
     }
     ```
- **Why:** Same instrumentation pattern as the vault commands, keeping the logging surface uniform
  across all use cases. `agent_send` logs only the size of the user turn to avoid persisting prompt
  text to disk.

### Step 6 — Update the domain glossary

- **File:** `.agents/ubiquitous-language.md`
- **Action:** MODIFY
- **Details:**
  1. Add a row to the **Core entities** table:
     ```
     | Backend logger | `logging::plugin` / `LogResult` (`src-tauri/src/logging.rs`) | "log utility", "tracing" | The backend logging utility (used by every Tauri command). Configures `tauri-plugin-log` to append leveled, timestamped lines to `logs/orbit-111.log` (relative to the app CWD — `src-tauri/` under `tauri dev`) + stdout. `LogResult::log_err(command)` is the extension every command chains onto its result to record failures. Not to be confused with the child-process stderr that `agent.rs` forwards to the frontend — that is engine output, not backend logs. |
     ```
  2. Bump the header `> **Last updated**:` line to `2026-07-08 (Backend file logger)`.
  3. Add a Changelog row:
     ```
     | 2026-07-08 | Added `logging::plugin` + `LogResult` | Backend file logger: `tauri-plugin-log` writing `logs/orbit-111.log`, entry+error logs wired into all seven Tauri commands |
     ```
- **Why:** `AGENTS.md` and the domain-glossary rule require the glossary to be updated whenever a
  new shared backend construct is introduced, and the "adapter forwards child stderr" vs. "backend
  logs to file" distinction is exactly the kind of ambiguity the glossary exists to prevent.

## Architecture Decisions

- **`tauri-plugin-log` over a fully hand-rolled logger** (user decision): the plugin handles file
  handling, timestamps, level filtering, and rotation, so the "utility" stays a thin configuration
  wrapper (`plugin()`) plus one ergonomic helper (`LogResult`). Avoids re-implementing timestamped
  file I/O and a `Mutex`-guarded writer by hand.
- **Module named `logging.rs`, not `log.rs`:** prevents shadowing the external `log` crate at the
  crate root, which would break `log::info!` resolution.
- **File location = working-dir-relative `logs/`** (user decision): `TargetKind::Folder` with a
  relative `path`. Under `tauri dev` this resolves to `src-tauri/logs/orbit-111.log`, already
  gitignored by the root `logs` / `*.log` patterns.
- **IIFE + `LogResult::log_err` for error capture:** using `?` inside a command returns before any
  trailing `.inspect_err`/`.log_err` could run. Wrapping each body in an immediately-invoked
  closure yields one `Result` expression, so a single `.log_err("<command>")` catches every failure
  path without rewriting the existing control flow. `agent_stop` is the one command with no error
  path, so it is left as a plain entry-log.
- **WARN global / INFO for `orbit_111_lib`:** keeps the log file focused on this app's own
  activity while suppressing verbose dependency chatter; relies on `level_for`'s target-prefix
  matching against the crate's `orbit_111_lib::*` module targets.
- **No custom log format:** the plugin's default format already prepends an ISO timestamp, level,
  and target — sufficient for v0. Revisit only if a specific format is requested.
- **No sensitive content logged:** `agent_send`/`write_note` log sizes, not payloads.

## Validation Criteria

- [x] `cd src-tauri && cargo build` succeeds (Rust compiles with the new dep + module).
- [x] `cd src-tauri && cargo clippy --all-targets` is clean (no new warnings from the closures/trait).
- [x] `pnpm check` (Biome) passes — no TS changed, but confirms nothing else regressed.
- [x] `pnpm tauri dev` launches and the file `src-tauri/logs/orbit-111.log` is created with a
      `orbit-111 backend started` INFO line, correctly formatted
      (`[date][time][orbit_111_lib][INFO] …`), confirming the plugin, `level_for` override, and
      `.setup` hook all work end-to-end.
- [ ] Manual (not run by an agent — requires driving the native app window): after opening a
      vault, reading/writing a note, and starting a chat turn, the log file also contains
      `pick_vault: …`, `read_vault_tree`, `read_note: path=…`, `write_note: path=… bytes=…`,
      `agent_spawn: …`, `agent_send: … bytes` lines.
- [ ] Manual: forcing a failure (e.g. `read_note` on a path outside the vault) writes a
      `read_note failed: …` ERROR line to the file.
- [x] `git status` / `git check-ignore -v` confirm the log file is untracked and covered by the
      root `.gitignore` (`logs` pattern).

## Open Questions

None. (Approach, foundation, and file location were confirmed with the user; stdout is included
alongside the file for dev convenience and can be dropped by removing the `TargetKind::Stdout`
target if file-only output is preferred.)
