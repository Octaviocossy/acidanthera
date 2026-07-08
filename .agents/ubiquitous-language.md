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
| Editor store | `useEditorStore` (`src/stores/editor-store.ts`) | "document store", "file store" | Zustand store owned by the editor slice. In-memory only: `content`, `dirty`, `vimMode`, `saveIntent`. No filesystem I/O in this slice — the filesystem slice (#12) and the sidebar open/save slice (#14) wire persistence against `saveIntent`/`markSaved`. |
| Editor vim mode | `EditorVimMode` (`src/stores/editor-store.ts`) | "vim mode" (ambiguous — see Flagged ambiguities) | One of `'normal' \| 'insert' \| 'visual' \| 'replace'`. CodeMirror's own vim mode (`@replit/codemirror-vim`), synced into `useEditorStore` by `vimModeSync` (`src/lib/editor/vim-mode-sync.ts`) via the `vim-mode-change` event. Distinct from the app-level `GlobalMode`. |
| Save intent | `saveIntent` (`src/stores/editor-store.ts`) | "save event", "save signal" | A monotonically increasing counter on `useEditorStore`, bumped by `requestSave()` on `:w` (vim ex-command, `src/lib/editor/save.ts`) or `Mod-s`. Represents "a save was requested" without performing any I/O — later slices subscribe to it to trigger the actual disk write. |
| Region exit (editor) | `regionExit` (`src/lib/editor/region-exit.ts`) | "vim keymap", "ctrl-w handler" | CM6 extension implementing the same `Ctrl-w` + `h`/`l`/`c` chord as `useGlobalKeymap`, at `Prec.highest` so the editor is authoritative while focused (doc/v0-spec.md §3.4 "CodeMirror coexistence rule"). Explicitly stops DOM propagation so `useGlobalKeymap`'s window-level listener never double-handles the same keydown. |
| Wikilink (editor) | `wikilink` (`src/lib/editor/wikilink.ts`) | "link decoration" | Inline `[[wikilink]]` rendering inside the CM6 markdown source (underline + hover, no color, per the design system's `Wikilink` component). A hand-built CM6 `ViewPlugin` decoration, not a mounted React component. |

---

## Relationships

- `useAppStore.activeRegion` (a `FocusRegion`) is only ever set to `'chat'` while `chatOpen` is `true`; closing the chat reassigns `activeRegion` away from `'chat'` if it was active.
- `useGlobalKeymap` reads and writes `useAppStore` state exclusively — it holds no state of its own beyond the transient `Ctrl-w` prefix-arm timer.
- `AiFab` is the only UI entry point that calls `useAppStore.toggleChat`; the global keymap's `Ctrl-w c` chord calls the same action, and so does the editor's own `regionExit` chord.
- `Viewer` (`src/components/layout/Viewer.tsx`) is the sole consumer of `useEditorStore`; `regionExit` reads/writes `useAppStore` the same way `useGlobalKeymap` does, but from inside the CM6 extension rather than a `window` listener.

---

## Flagged ambiguities

- **"Vim mode" is two distinct systems** (doc/v0-spec.md §3.4): the app-level `GlobalMode` (`normal`/`command`, app shell slice) and the editor's own CodeMirror vim mode (`EditorVimMode`, editor slice, backed by `@replit/codemirror-vim`). Do not merge these into one enum or one store — they are deliberately separate state machines that only hand off focus at the region boundary.

---

## Changelog

| Date | Change | Reason |
|------|--------|--------|
| [YYYY-MM-DD] | Initial scaffold | Project created |
| 2026-07-08 | Added `FocusRegion`, `GlobalMode`, `useAppStore`, `useGlobalKeymap`, `AiFab` | App shell slice (#10): focus/mode state machine + global vim keymap foundation |
| 2026-07-08 | Added `useEditorStore`, `EditorVimMode`, `saveIntent`, `regionExit`, `wikilink` | Editor slice (#11): CodeMirror 6 markdown editor with vim + `Ctrl-w` coexistence |
