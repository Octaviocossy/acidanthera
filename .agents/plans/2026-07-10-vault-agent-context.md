# Plan: Scaffold AGENTS.md / CLAUDE.md agent context in the vault root

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #41

## Goal

Give every vault Orbit opens an `AGENTS.md` + `CLAUDE.md` pair at its root, so the headless
engines — which run with `cwd` set to the vault — load instructions describing what the vault is
and how the agent should behave in it, instead of starting with no project context at all.

## Context

- **What exists today.** `useChatStore.sendMessage` passes `useAppStore.vaultRoot` as the agent's
  `cwd` (`AgentBackend.start`). Both engines load a project-instructions file from that `cwd`
  (doc/v0-spec.md §4.4: *"the project instructions file is loaded (`CLAUDE.md` / `AGENTS.md`)"*),
  and neither backend passes a flag that skips it. But nothing ever creates those files, so the
  default vault (`~/Documents/orbit-brain`, created on first boot by `open_vault`) has none — the
  agent runs context-free and has no way to know it should produce wikilinked notes rather than
  co-edit the file the user has open (§4.5).
- **Trigger.** Issue #41. No plan file existed; this one was written alongside the implementation.
- **Constraints.**
  - A vault is the user's own folder. The scaffold must never clobber a file already there.
  - `open_vault` runs on *every* boot (`useSettingsBootstrap`), not just the first — so the
    scaffold must be idempotent, not a one-shot "first run" step.
  - A vault on a read-only mount must still open; a failed scaffold cannot fail the vault.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src-tauri/templates/vault-agents.md` | The `AGENTS.md` template baked into the binary |
| CREATE | `src-tauri/templates/vault-claude.md` | The `CLAUDE.md` template — a thin `@AGENTS.md` import |
| MODIFY | `src-tauri/src/vault.rs` | `AGENT_CONTEXT_FILES` + `scaffold_file` / `scaffold_agent_context` / `scaffold_agent_context_or_warn`; call from `open_vault` and `pick_vault`; unit tests |
| MODIFY | `.agents/ubiquitous-language.md` | New "Vault agent context" entity, relationships, changelog |
| CREATE | `.agents/plans/2026-07-10-vault-agent-context.md` | This plan |

## Step-by-Step Implementation

**Step 1 — Write the two templates**

- **Files:** `src-tauri/templates/vault-agents.md`, `src-tauri/templates/vault-claude.md`
- **Action:** CREATE
- **Details:** `vault-agents.md` describes the vault (a folder of plain `.md` notes, no database,
  sidebar shows only Markdown), how to write notes (one idea per note, `# Heading` matching the
  filename, `[[Wikilinks]]` as the structure), and how to behave (produce notes, don't rewrite the
  open one; search before writing; stay inside the root). It ends with an empty `## House rules`
  section for the user. `vault-claude.md` is a `# CLAUDE.md` heading plus `@AGENTS.md` and a
  comment explaining the split.
- **Why:** Real `.md` files rather than Rust raw strings — editable as markdown, and Biome ignores
  them (`files.ignoreUnknown: true`). `include_str!` bakes them into the binary at compile time.

**Step 2 — Scaffold helpers in `vault.rs`**

- **File:** `src-tauri/src/vault.rs`
- **Action:** MODIFY
- **Details:**
  - Add `use std::io::Write` (needed for `write_all`).
  - `const AGENT_CONTEXT_FILES: [(&str, &str); 2]` pairing each filename with its
    `include_str!("../templates/…")` body.
  - `fn scaffold_file(root: &Path, name: &str, contents: &str) -> VaultResult<bool>` — opens with
    `OpenOptions::new().write(true).create_new(true)`, writes, returns `true`; maps
    `ErrorKind::AlreadyExists` to `Ok(false)`; propagates anything else.
  - `fn scaffold_agent_context(root: &Path) -> VaultResult<Vec<&'static str>>` — `filter_map` over
    `AGENT_CONTEXT_FILES` collecting into `Result<Vec<_>, _>`, yielding the names actually created.
  - `fn scaffold_agent_context_or_warn(root: &Path)` — logs created names at `info`, swallows the
    error at `warn`.
- **Why:** `create_new` is atomic, matching `create_note_in`'s existing never-clobber semantics.
  Per-file (rather than "scaffold only if both are absent") means deleting one restores exactly
  that one.

**Step 3 — Call it from both adopt paths**

- **File:** `src-tauri/src/vault.rs`
- **Action:** MODIFY
- **Details:** `scaffold_agent_context_or_warn(&root);` immediately before `watch(&app, &state, …)`
  in both `open_vault` and `pick_vault`.
- **Why:** Before `watch`, so the frontend's first `read_vault_tree` already sees the pair and the
  app's own boot-time writes don't emit a spurious `vault-changed`. Both paths, because the agent's
  `cwd` is whichever vault is open — scaffolding only the default vault would half-ship the feature.

**Step 4 — Unit tests** (`src-tauri/src/vault.rs`, `mod tests`)

- `claude_context_template_should_import_the_agents_template` — pins the `@AGENTS.md` link.
- `scaffold_agent_context_should_create_both_files_in_a_fresh_vault`
- `scaffold_agent_context_should_surface_both_files_in_the_tree` — pins the "visible as notes" call.
- `scaffold_agent_context_should_not_clobber_an_existing_file` — hand-written `AGENTS.md` survives;
  the missing `CLAUDE.md` is still filled in.
- `scaffold_agent_context_should_be_idempotent_across_reopens` — second call returns `[]` and leaves
  the user's edit intact.

**Step 5 — Glossary** (`.agents/ubiquitous-language.md`): add the "Vault agent context" entity row,
four relationship bullets, a changelog row, and bump "Last updated".

## Architecture Decisions

- **Rust, not TypeScript.** The scaffold belongs to vault adoption, which is a backend concern
  (`open_vault` already does `create_dir_all`). Doing it frontend-side would need a new command
  anyway and would race the watcher.
- **Per-file `create_new`, not "skip if any context exists".** Simpler and predictable, and it
  matches `create_note`'s never-clobber rule. Trade-off: a folder that already has a `CLAUDE.md`
  but no `AGENTS.md` (i.e. a code repo picked as a vault) gains an `AGENTS.md`. Bounded — we never
  modify what's there — and a code repo is not a vault.
- **The pair is visible in the sidebar.** They are plain `.md` files, so `build_tree` lists them.
  Hiding them would need a filter and would make the agent's own instructions un-openable from the
  app; showing them makes the agent's context tunable in the editor like any other note.
- **Scaffold failure is non-fatal.** A read-only root logs a warning and still opens. The agent
  degrades to running without project instructions rather than the vault failing to load.
- **`CLAUDE.md` imports `AGENTS.md`.** The same bridge pattern this repo uses for its own root
  `CLAUDE.md`, keeping one source of truth across the two engines.

## Validation Criteria

- [x] `cargo test --manifest-path src-tauri/Cargo.toml` — 18 vault tests pass (5 new)
- [x] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` — no warnings
- [x] `pnpm check` (Biome lint + format)
- [x] `pnpm build` (`tsc && vite build`)
- [ ] Manual smoke: delete `~/Documents/orbit-brain/AGENTS.md`, relaunch — the file returns, and an
      edited `CLAUDE.md` is left untouched. *(Not run: no GUI session in the headless runner.)*

## Open Questions

- `cargo fmt --check` was already failing on `main` before this change (the existing code exceeds
  rustfmt's default 100-column `max_width`, and there is no `rustfmt.toml`). New code matches the
  surrounding wide-line style; a repo-wide `cargo fmt` — or a committed `rustfmt.toml` pinning
  `max_width` to the style actually in use — is left as separate cleanup.
