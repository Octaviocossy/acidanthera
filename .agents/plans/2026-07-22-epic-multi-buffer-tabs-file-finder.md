# Plan: Epic - Multi-buffer Tabs and Fuzzy File Finder

> Status: **draft**
> Created: 2026-07-22
> Updated: 2026-07-22
> Issue: #81
> Integration branch: `epic/81-multi-buffer-tabs-file-finder`

## Goal

Add session-only editor buffers with independent CodeMirror state, expose them through an accessible tab strip with guarded dirty-close behavior, and add a Spotlight-like fuzzy vault-file finder opened by `Ctrl-w`, then `f`. Orbit starts with no active buffer and shows only the plain theme-aware background in the current-file area until a note is opened.

## Context

- Orbit currently initializes one editable `Untitled` document in `useEditorStore`; opening another note replaces it.
- The target behavior starts with `buffers: []` and `activeBufferId: null`. No implicit scratch document, CodeMirror surface, Vim badge, visible prompt, or artwork appears before the first note opens.
- Save intent currently targets whichever document is active when the save effect runs, which is unsafe after introducing buffer switching.
- The app has no leader key. It already has a 1.5-second `Ctrl-w` app prefix for `h`, `l`, `b`, `c`, and `s`; this epic extends it with `f`.
- The recursive `VaultEntry[]` already held by `useSidebarStore` is sufficient for file discovery, so no Rust command or dependency is required.
- Product decisions are fixed: tabs are session-only, each open buffer preserves cursor/selection/Vim/undo state, dirty tabs use Save/Discard/Cancel, and closing the final tab restores the background-only current-file area.
- The work is split into three waves. Wave 1 establishes shared contracts and glossary terms. The two Wave-2 children then modify disjoint existing files and can auto-merge safely.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `.agents/ubiquitous-language.md` | Define all epic entities, processes, and relationships once |
| MODIFY | `src/stores/editor-store.ts` | Add ordered buffers, revisions, targeted saves, nullable activation, and close state |
| CREATE | `src/stores/editor-store.test.ts` | Test the multi-buffer store contract |
| MODIFY | `src/lib/vault/open-file.ts` | Deduplicate and activate open buffers |
| CREATE | `src/lib/vault/open-file.test.ts` | Test buffered-path deduplication |
| CREATE | `src/lib/editor/save-buffer.ts` | Save immutable buffer snapshots |
| CREATE | `src/lib/editor/save-buffer.test.ts` | Test targeted save behavior and races |
| MODIFY | `src/hooks/use-save-loop.ts` | Drain explicit save snapshots sequentially |
| CREATE | `src/hooks/use-save-loop.test.ts` | Test save-queue routing |
| MODIFY | `src/lib/editor/vim-mode-sync.ts` | Synchronize Vim mode per buffer |
| CREATE | `src/components/editor/BufferEditor.tsx` | Own one mounted CodeMirror view per buffer |
| CREATE | `src/components/editor/BufferEditor.test.tsx` | Test independent CodeMirror state |
| MODIFY | `src/components/layout/Viewer.tsx` | Render buffers or the default background, then add tabs and close dialog |
| CREATE | `src/components/layout/Viewer.test.tsx` | Test the background-only no-buffer current-file area |
| MODIFY | `src/components/layout/Sidebar.tsx` | Highlight the active saved buffer |
| MODIFY | `src/lib/vault/create-entry.test.ts` | Adapt create-entry coverage to buffers |
| CREATE | `src/components/editor/EditorTabs.tsx` | Render and activate open-buffer tabs |
| CREATE | `src/components/editor/EditorTabs.test.tsx` | Test tab semantics and interactions |
| CREATE | `src/components/editor/CloseBufferDialog.tsx` | Confirm Save/Discard/Cancel when closing dirty buffers |
| CREATE | `src/components/editor/CloseBufferDialog.test.tsx` | Test Save/Discard/Cancel behavior |
| CREATE | `src/lib/vault/file-search.ts` | Collect and rank vault file candidates |
| CREATE | `src/lib/vault/file-search.test.ts` | Test traversal and fuzzy ranking |
| CREATE | `src/stores/file-finder-store.ts` | Store finder visibility, query, and cursor |
| CREATE | `src/stores/file-finder-store.test.ts` | Test finder state transitions |
| CREATE | `src/components/layout/FileFinder.tsx` | Render the floating file-finder dialog |
| CREATE | `src/components/layout/FileFinder.test.tsx` | Test finder accessibility and interaction |
| MODIFY | `src/components/layout/Layout.tsx` | Mount the finder at the intended overlay layer |
| MODIFY | `src/components/layout/StatusBar.tsx` | Add a mouse-accessible finder entry point |
| CREATE | `src/lib/app-command.ts` | Dispatch the canonical find-file command |
| MODIFY | `src/hooks/use-global-keymap.ts` | Add global `Ctrl-w f` handling |
| CREATE | `src/hooks/use-global-keymap.test.tsx` | Test global prefix behavior |
| MODIFY | `src/lib/editor/region-exit.ts` | Add CodeMirror-authoritative `Ctrl-w f` handling |
| CREATE | `src/lib/editor/region-exit.test.ts` | Test editor prefix precedence and modes |
| MODIFY | `doc/keybindings.md` | Document the app prefix and finder chord |

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #82 | `82-multi-buffer-editor-foundation` | feat: add multi-buffer editor foundation | pending |
| 2 | #83 | `83-floating-fuzzy-file-finder` | feat: add floating fuzzy file finder | pending |
| 2 | #84 | `84-editor-tabs-dirty-close-lifecycle` | feat: add editor tabs and dirty-close lifecycle | pending |
| 3 | #85 | `85-ctrl-w-f-file-finder` | feat: open file finder with Ctrl-w f | pending |

## Dependency Edges

```text
83 -> 82
84 -> 82
85 -> 83
```

## Step-by-Step Implementation

1. **Implement and integrate the multi-buffer foundation from #82.**

   - **Branch:** `82-multi-buffer-editor-foundation`
   - **Files:** `src/stores/editor-store.ts`, `src/lib/vault/open-file.ts`, `src/lib/editor/save-buffer.ts`, `src/hooks/use-save-loop.ts`, `src/lib/editor/vim-mode-sync.ts`, `src/components/editor/BufferEditor.tsx`, `src/components/layout/Viewer.tsx`, `src/components/layout/Sidebar.tsx`, their tests, and `.agents/ubiquitous-language.md`.
   - **Action:** Replace single-document state with ordered `EditorBuffer` records and immutable `EditorSaveRequest` snapshots:

     ```ts
     interface EditorBuffer {
       id: string;
       filePath: string;
       title: string;
       content: string;
       dirty: boolean;
       revision: number;
       savedRevision: number;
       vimMode: EditorVimMode;
     }

     interface EditorSaveRequest {
       id: number;
       bufferId: string;
       filePath: string;
       content: string;
       revision: number;
     }
     ```

   - **Details:** Initialize with zero buffers and nullable activation. Deduplicate buffers by absolute path, capture save snapshots before asynchronous I/O, process writes sequentially, and mark only the completed revision saved. Keep one mounted `BufferEditor` per open buffer so CodeMirror owns independent cursor, selection, Vim, plugin, and undo state. When no buffer is active, preserve the outer Viewer and its `bg-bg` surface while rendering no editor chrome or visible empty-state content.
   - **Why:** Both Wave-2 features depend on stable multi-buffer/open/save contracts, and all shared glossary changes must land before parallel work.

2. **Implement the two independent Wave-2 user interfaces after #82 is integrated.**

   - **Branch #83:** `83-floating-fuzzy-file-finder`
   - **Files #83:** `src/lib/vault/file-search.ts`, `src/stores/file-finder-store.ts`, `src/components/layout/FileFinder.tsx`, `src/components/layout/Layout.tsx`, `src/components/layout/StatusBar.tsx`, and co-located tests.
   - **Action #83:** Recursively collect current-root `VaultEntry` files, rank them with a deterministic dependency-free subsequence score, and expose a dialog/combobox/listbox UI that opens through `openVaultFile`. Opening a result from the no-buffer state creates and activates the first buffer.

     ```ts
     function collectVaultFiles(
       tree: readonly VaultEntry[],
       vaultRoot: string,
     ): VaultFileCandidate[];

     function rankVaultFiles(
       candidates: readonly VaultFileCandidate[],
       query: string,
       limit?: number,
     ): VaultFileCandidate[];
     ```

   - **Branch #84:** `84-editor-tabs-dirty-close-lifecycle`
   - **Files #84:** `src/components/editor/EditorTabs.tsx`, `src/components/editor/CloseBufferDialog.tsx`, `src/components/layout/Viewer.tsx`, `src/lib/editor/save-buffer.ts`, and co-located tests.
   - **Action #84:** Render an accessible tab list over the already-mounted buffer editors. Render no tab strip when the buffer list is empty. Clean buffers close immediately and dirty buffers show Save/Discard/Cancel. Close after Save only when the write succeeds and the saved buffer has not acquired newer edits. Closing the final tab leaves zero buffers and restores the background-only Viewer.
   - **Why:** These slices are independently user-observable and modify disjoint existing files, allowing the runner to execute and merge them concurrently.

3. **Add the finder chord after #83 is integrated.**

   - **Branch:** `85-ctrl-w-f-file-finder`
   - **Files:** `src/lib/app-command.ts`, `src/hooks/use-global-keymap.ts`, `src/lib/editor/region-exit.ts`, `doc/keybindings.md`, and co-located tests.
   - **Action:** Introduce one canonical command boundary and dispatch it from both keyboard layers:

     ```ts
     type AppCommandId = "find-file";

     function executeAppCommand(command: AppCommandId): void;
     ```

   - **Details:** Add exact lowercase `f` to the established 1.5-second `Ctrl-w` prefix. Preserve CodeMirror's highest-precedence handling and propagation stop so the finder opens once. Match current prefix behavior across Normal, Insert, Visual, and Replace modes. Keep editable targets isolated.
   - **Why:** The shortcut must depend on the finder store but need not block the parallel tab work.

4. **Validate the fully integrated epic branch before opening the final pull request.**

   - **Branch:** `epic/81-multi-buffer-tabs-file-finder`
   - **Action:** Run all project acceptance commands, then exercise buffer, tab, finder, and keybinding behavior in the Tauri app.
   - **Details:** Confirm that buffered unsaved content cannot be overwritten by reopening, saves target immutable snapshots, tabs preserve CodeMirror state, dirty close paths are safe, nested files are searchable, and `Ctrl-w f` does not regress existing prefix actions.
   - **Why:** The final pull request is the only merge into `main`, so cross-child behavior must be checked on the integrated branch.

## Architecture Decisions

- Start with zero buffers and nullable active-buffer state; do not create an implicit `Untitled` or scratch document.
- Keep buffers in memory for the current application session; do not add settings or Rust persistence.
- Render only the existing theme-aware `bg-bg` surface when no buffer is active, without visible text, artwork, tabs, CodeMirror, or a Vim badge.
- Keep one mounted CodeMirror view per open buffer to preserve complete editor state through public component behavior.
- Use absolute paths as saved-buffer identity.
- Capture save content and revisions when save is requested rather than when asynchronous processing begins.
- Keep stores free of filesystem I/O; compose them with `vaultService` in editor/vault helpers.
- Reuse the recursive sidebar tree for finder candidates and filter paths by the active vault root.
- Implement deterministic fuzzy matching locally rather than changing `package.json` or `pnpm-lock.yaml`.
- Keep the finder as an in-window overlay, not a new native window or `FocusRegion`.
- Extend the established `Ctrl-w` app prefix; do not introduce or persist a leader key.
- Put every new domain term in the Wave-1 glossary update so Wave-2 branches remain merge-safe.

## Validation Criteria

- [ ] #82, #83, #84, and #85 are integrated into `epic/81-multi-buffer-tabs-file-finder` with merge commits discoverable by the runner.
- [ ] Orbit starts with no buffers and no active buffer.
- [ ] The initial and final-close current-file area shows only its plain theme-aware background, with no editor chrome, visible prompt, artwork, or replacement `Untitled` buffer.
- [ ] Opening the first finder result creates and activates the first buffer.
- [ ] Opening and reopening multiple notes preserves independent unsaved text, cursor, selection, Vim state, and undo history.
- [ ] Save requests write the intended immutable buffer snapshot and do not clear newer edits.
- [ ] Tabs expose correct accessibility state and safe clean/dirty close behavior, and the tab strip is absent when no buffers exist.
- [ ] The finder searches all current-vault Markdown notes independently of sidebar expansion.
- [ ] Finder failures preserve the query and show an error toast.
- [ ] `Ctrl-w f` opens exactly one finder in shell and editor contexts without regressing `h/l/b/c/s`.
- [ ] `pnpm check` passes on the integrated epic branch.
- [ ] `pnpm build` passes on the integrated epic branch.
- [ ] `pnpm test` passes on the integrated epic branch.
- [ ] Manual `pnpm tauri dev` smoke tests pass for buffers, tabs, close confirmation, finder interaction, and keybindings.
- [ ] No Rust source, settings schema, package manifest, or lockfile changes are introduced.

## Open Questions

None for this epic. Vault switching with dirty buffers, external file modification/deletion reconciliation, Save As, scratch buffers, tab restoration, file-content search, recency ranking, and configurable keybindings are explicitly deferred.
