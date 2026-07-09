# Plan: Persisted settings store + default vault bootstrap

> Status: **completed**
> Created: 2026-07-09
> Updated: 2026-07-09
> Issue: #25

## Goal

Give the app a persisted settings foundation — agent engine, editor font, theme, and vault
path, stored as JSON in the app config dir — and bootstrap a default vault
(`~/Documents/orbit-brain`, created if missing) on startup, so the app opens ready to use
without the manual "Open vault…" step.

## Context

- Child #25 of epic #24 (`.agents/plans/2026-07-09-epic-settings-ux.md`), wave 1, no
  dependencies. #28 (apply theme & editor font) and #29 (settings dialog) depend on this
  slice's `Settings` shape and store.
- Note: the GitHub issue body was unreachable from the headless runner (private repo, no
  GitHub access by design), so this plan was reconstructed from the epic plan's goal —
  "agent engine, editor font, dark/light theme, and vault path (defaulting to
  `~/Documents/orbit-brain`)" — and the repo's existing slice conventions.
- Today: no persistence at all. `vaultRoot` starts `null` every boot and the user must click
  "Open vault…"; the chat engine resets to `claude-code`; theme/font are hard-coded tokens.
- Persistence follows the repo's hand-built-command pattern (no `tauri-plugin-store`):
  a `settings.rs` module mirroring `vault.rs`'s error/logging conventions, wrapped by a
  typed frontend service and a Zustand store.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src-tauri/src/settings.rs` | `Settings` struct + `read_settings`/`write_settings` commands persisting `settings.json` in the app config dir |
| MODIFY | `src-tauri/src/vault.rs` | Add `open_vault(path)` command — adopt a known path (create if missing) without a picker |
| MODIFY | `src-tauri/src/lib.rs` | Register `settings` module + new commands |
| CREATE | `src/services/settings.service.ts` | Typed wrapper over the settings commands |
| MODIFY | `src/services/vault.service.ts` | Add `openVault(path)` wrapper |
| CREATE | `src/stores/settings-store.ts` | Zustand settings store: load-once + write-through `updateSettings` |
| CREATE | `src/hooks/use-settings-bootstrap.ts` | Boot hook: load settings → seed chat engine → open vault at `settings.vaultPath` → seed `vaultRoot` |
| MODIFY | `src/App.tsx` | Mount `useSettingsBootstrap()` |
| MODIFY | `src/components/layout/Sidebar.tsx` | Persist a manually picked vault back into `settings.vaultPath` |
| MODIFY | `.agents/ubiquitous-language.md` | New entities + changelog row |

## Step-by-Step Implementation

> **Step 1 — Rust settings module**
>
> - **File:** `src-tauri/src/settings.rs`
> - **Action:** CREATE
> - **Details:**
>   - `Settings { engine: String, editor_font: String, theme: String, vault_path: String }`,
>     `Serialize + Deserialize`, `rename_all = "camelCase"`, `#[serde(default …)]` per field so
>     future fields deserialize from older files.
>   - Defaults: `engine = "claude-code"`, `editor_font = "JetBrains Mono"`, `theme = "dark"`,
>     `vault_path = "" `(empty sentinel — resolved to `document_dir()/orbit-brain` at read time,
>     since the real default needs an `AppHandle`).
>   - `SettingsError` (`thiserror`): `Io`, `Json`, `Path(tauri::Error)`; string-`Serialize`
>     like `VaultError`.
>   - `read_settings(app)` command: parse `app_config_dir()/settings.json` if present, else
>     defaults; fill an empty `vault_path` with the resolved default.
>   - `write_settings(app, settings)` command: `create_dir_all` the config dir, write pretty
>     JSON. Both commands log entry + `log_err` like every other command.
> - **Why:** matches `vault.rs`/`logging.rs` conventions; JSON file in the platform config dir
>   survives webview storage resets and is hand-editable.

> **Step 2 — `open_vault` command**
>
> - **File:** `src-tauri/src/vault.rs`
> - **Action:** MODIFY
> - **Details:** `open_vault(path: String, app, state) -> VaultResult<String>` —
>   `fs::create_dir_all(&path)`, reject non-directories (`InvalidPath`), canonicalize, reuse
>   `watch()`, return the canonical path string. Same shape as `pick_vault` minus the dialog.
> - **Why:** the bootstrap (and later the settings dialog) must adopt a stored path
>   programmatically; `pick_vault` is interactive-only.

> **Step 3 — frontend service + store**
>
> - **Files:** `src/services/settings.service.ts` (CREATE), `src/services/vault.service.ts`
>   (MODIFY), `src/stores/settings-store.ts` (CREATE)
> - **Details:**
>   - `Settings` TS mirror: `{ engine: AgentSource; editorFont: string; theme: ThemeName; vaultPath: string }`
>     with `type ThemeName = 'dark' | 'light'`.
>   - `settingsService.readSettings()` / `writeSettings(settings)`; `vaultService.openVault(path)`.
>   - `useSettingsStore`: `settings: Settings | null` (null until loaded), `loadSettings()`
>     (idempotent read), `updateSettings(patch)` (merge + optimistic set + `writeSettings`).
> - **Why:** stores never call `invoke` directly in this codebase; services own the IPC types.

> **Step 4 — bootstrap hook + wiring**
>
> - **Files:** `src/hooks/use-settings-bootstrap.ts` (CREATE), `src/App.tsx` (MODIFY),
>   `src/components/layout/Sidebar.tsx` (MODIFY)
> - **Details:**
>   - Hook (mounted once, `useEffect` with cancellation flag): `loadSettings()`; seed
>     `useChatStore.setBackend(settings.engine)` when no session started; then
>     `vaultService.openVault(settings.vaultPath)` → `setVaultRoot(root)`. Failures log to
>     console and leave `vaultRoot` null (sidebar still offers "Open vault…").
>   - Sidebar's `handleOpenVault`: after `pickVault()` resolves, also
>     `updateSettings({ vaultPath: root })` so the choice persists across restarts.
> - **Why:** completes "default vault bootstrap" end-to-end while keeping the manual picker
>   as the recovery path.

> **Step 5 — glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY — add `Settings`/`settingsService`, `useSettingsStore`,
>   `useSettingsBootstrap`, `open_vault`; relationships; changelog row; bump "Last updated".

## Architecture Decisions

- **Hand-built commands over `tauri-plugin-store`:** consistent with every existing slice
  (vault, agent, logging); zero new dependencies; #29 gets a typed contract, not a KV bag.
- **`engine` is seeded into the chat store at boot only.** Reactive engine switching from
  the settings dialog is #29's wiring; the ChatPanel selector remains a per-session override.
- **Theme/font are stored but not applied** — application is #28 by the epic's dependency
  graph (`28 -> 25`).
- **Empty-string `vault_path` sentinel** instead of `Option<String>`: the settings file
  always round-trips a concrete resolved path after first read, which is what #29's dialog
  needs to display.

## Validation Criteria

- [x] `pnpm build` passes (tsc + vite)
- [x] `pnpm lint` passes
- [x] `cargo check` + `cargo clippy` pass in `src-tauri/`; `cargo test` — 3 new unit tests
      pinning the `settings.json` format (camelCase, per-field defaults, round-trip) pass
- [ ] First boot: `~/Documents/orbit-brain` is created, watcher starts, sidebar shows the tree
      _(not verified — GUI smoke test not possible from the headless runner)_
- [ ] `settings.json` appears in the app config dir after any `updateSettings` _(same)_
- [ ] Picking a vault manually persists it and it reopens on next boot _(same)_

## Open Questions

None (issue body unavailable; deviations, if any, to be reconciled at ship-note time).
