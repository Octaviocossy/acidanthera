# Ubiquitous Language

> Single source of truth for domain terminology. Update when entities, relationships,
> or naming conventions change. AI tools should read this before inspecting source files.
>
> **Last updated**: 2026-07-08
> **Canonical types**: `src/` (TS), `src-tauri/src/` (Rust)

---

## How to maintain this document

1. **Add terms** when a new entity, state, or process enters the codebase.
2. **Add aliases to avoid** when ambiguity appears in PRs, chats, or AI-generated code.
3. **Update relationships** when entity connections change (new FK, removed link, etc.).
4. **Flag ambiguities** when a term means different things in different contexts.
5. **Bump "Last updated"** on every edit so AI tools know how fresh the context is.

---

## Core entities

| Term | Canonical type | Aliases to avoid | Notes |
|------|-----------------|-------------------|-------|
| Focus region | `FocusRegion` (`src/stores/app-store.ts`) | "pane", "panel" (as a state value) | One of `'sidebar' \| 'viewer' \| 'chat'`. The app-level focus target — not to be confused with the editor's own DOM focus. |
| Global mode | `GlobalMode` (`src/stores/app-store.ts`) | "vim mode" (ambiguous — see Flagged ambiguities) | One of `'normal' \| 'command'`. The **app-level** vim mode driven by the global keymap, distinct from CodeMirror's own vim mode (`@replit/codemirror-vim`), which is a separate system owned by the editor slice. |
| App store | `useAppStore` (`src/stores/app-store.ts`) | "global store", "app context" | Zustand store. Single source of truth for `activeRegion`, `mode`, `chatOpen`, `vaultRoot`. `vaultRoot` lives here (not a filesystem-specific store) so slices that need the vault path (e.g. the agent's `cwd`) don't depend on the sidebar/filesystem slice. |
| Global keymap | `useGlobalKeymap` (`src/hooks/use-global-keymap.ts`) | "keybindings", "shortcuts" | The app-level `Ctrl-w` chord (`h`/`l` region jump, `c` chat toggle) + `:`/`Escape` mode transitions. Registered on `window` in the bubble phase so a future CodeMirror instance can `stopPropagation()` to keep its own top-precedence handling authoritative. |
| AiFab | `AiFab` (`src/components/ai/AiFab.tsx`) | "chat button", "toggle button" | The floating action button that opens/closes the chat region. The **only** place the reserved lime accent (`--fab-accent`) is rendered. |
| VaultEntry | `VaultEntry` (`src-tauri/src/vault.rs`), mirrored as a TS interface in `src/services/vault.service.ts` | "file node", "tree node" | A file or directory inside the open vault, filtered to `.md` notes. A directory is only included if it (transitively) contains at least one `.md` file; hidden entries (`.git`, `.obsidian`, …) are always skipped. |
| VaultState | `VaultState` (`src-tauri/src/vault.rs`) | — | Rust-side `tauri::State`: the currently open vault root path plus the live `notify::RecommendedWatcher` watching it. Replacing the watcher (via `pick_vault`) drops and thus stops the previous one. |
| vaultService | `vaultService` (`src/services/vault.service.ts`) | "fs service", "file service" | Typed wrapper over the Rust vault commands (`pick_vault`, `read_vault_tree`, `read_note`, `write_note`) and the `vault-changed` event. Deliberately does not import `useAppStore` — callers own writing the picked path into `vaultRoot` — so the filesystem data layer stays decoupled from app-level state. |
| `vault-changed` (event) | emitted by `src-tauri/src/vault.rs`, consumed via `vaultService.onVaultChanged` | — | Fired by the Rust `notify` watcher on every filesystem event inside the open vault root. Payload is the list of touched absolute paths (as strings). |

---

## Relationships

- `useAppStore.activeRegion` (a `FocusRegion`) is only ever set to `'chat'` while `chatOpen` is `true`; closing the chat reassigns `activeRegion` away from `'chat'` if it was active.
- `useGlobalKeymap` reads and writes `useAppStore` state exclusively — it holds no state of its own beyond the transient `Ctrl-w` prefix-arm timer.
- `AiFab` is the only UI entry point that calls `useAppStore.toggleChat`; the global keymap's `Ctrl-w c` chord calls the same action.
- `read_note`/`write_note` accept a `path` string that must resolve (after canonicalization) inside the current `VaultState` root — in practice this should always be a `path` value previously returned by `read_vault_tree`, since arbitrary strings are rejected by the guard.
- `vaultService.pickVault()` resolves to the chosen folder's path; it does not itself call `useAppStore.setVaultRoot` — that wiring belongs to whichever slice invokes it (the sidebar/vault-open loop).

---

## Flagged ambiguities

- **"Vim mode" is two distinct systems** (doc/v0-spec.md §3.4): the app-level `GlobalMode` (`normal`/`command`, this slice) and the editor's own CodeMirror vim mode (`@replit/codemirror-vim`, added by the editor slice). Do not merge these into one enum or one store — they are deliberately separate state machines that only hand off focus at the region boundary.

---

## Changelog

| Date | Change | Reason |
|------|--------|--------|
| [YYYY-MM-DD] | Initial scaffold | Project created |
| 2026-07-08 | Added `FocusRegion`, `GlobalMode`, `useAppStore`, `useGlobalKeymap`, `AiFab` | App shell slice (#10): focus/mode state machine + global vim keymap foundation |
| 2026-07-08 | Added `VaultEntry`, `VaultState`, `vaultService`, `vault-changed` | Filesystem slice (#12): Rust vault read/write commands + `notify` watcher |
