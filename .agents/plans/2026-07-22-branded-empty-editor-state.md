# Plan: Branded Empty Editor State

> Status: **completed**
> Created: 2026-07-22
> Updated: 2026-07-22
> Issue: #87

## Goal

Start with no editor buffers or tabs and make the empty Viewer recognizably Orbit with a wordmark and its file-finder shortcut.

## Context

- The epic implementation currently retains an implicit `Untitled` scratch buffer despite #82 and #84 specifying zero-buffer startup and final close.
- The selected empty-state copy is `ORBIT` plus `Ctrl-w f to open a note`.
- This issue is a corrective child of #81 and must be based on its integration branch.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/stores/editor-store.ts` | Remove scratch buffers and allow nullable activation |
| MODIFY | `src/stores/editor-store.test.ts` | Cover empty state and final close |
| MODIFY | `src/components/layout/Viewer.tsx` | Render the branded empty Viewer |
| CREATE | `src/components/layout/Viewer.test.tsx` | Cover the empty visual and first buffer |
| MODIFY | `src/components/layout/Sidebar.tsx` | Handle missing active buffer |
| MODIFY | `src/components/editor/EditorTabs.tsx` | Suppress an empty tab rail |
| MODIFY | `src/components/editor/EditorTabs.test.tsx` | Cover zero tabs |
| MODIFY | `src/components/editor/CloseBufferDialog.tsx` | Remove scratch-only behavior |
| MODIFY | `src/components/editor/CloseBufferDialog.test.tsx` | Update dialog coverage |
| MODIFY | `src/lib/vault/open-file.test.ts` | Cover first file opening from empty |
| MODIFY | `src/lib/vault/create-entry.test.ts` | Use empty editor fixtures |
| MODIFY | `.agents/ubiquitous-language.md` | Define the branded no-buffer state |

## Step-by-Step Implementation

1. **Remove the implicit scratch buffer.**
   - **File:** `src/stores/editor-store.ts`
   - Initialize `buffers` to `[]` and `activeBufferId` to `null`; remove scratch creation and make `activeEditorBuffer` return `EditorBuffer | null`.
   - Make `openFile` create and activate a path-backed buffer when empty; make `closeBuffer` restore `[]`/`null` after final close.
   - **Why:** No-file state belongs to the Viewer, not a fake document.

2. **Render the empty Viewer.**
   - **File:** `src/components/layout/Viewer.tsx`
   - When no active buffer exists, omit tabs, CodeMirror, Vim badge, and dialog; center `ORBIT` using existing `font-sans`, `text-display`, `tracking-display`, and `text-text-faint` utilities plus the mono `Ctrl-w f to open a note` hint.
   - **Why:** Gives users a clear first-run and final-close state with no new visual language.

3. **Make consumers and tests nullable-safe.**
   - **Files:** all listed component, store, and vault tests plus `Sidebar.tsx`, `EditorTabs.tsx`, and `CloseBufferDialog.tsx`.
   - Assert empty startup/final close, no editor chrome, visible wordmark/hint, and first-open behavior; retain existing buffer deduplication and dirty-close behavior.
   - **Why:** Prevents empty state regressions at all editor-store boundaries.

4. **Update the glossary.**
   - **File:** `.agents/ubiquitous-language.md`
   - Define the no-buffer Viewer state and bump the update date/changelog.
   - **Why:** Makes the corrected product language canonical.

## Architecture Decisions

- The `ORBIT` treatment is display-only; `Ctrl-w f` is not a button.
- Existing theme and typography tokens supply all visual styling.
- No Rust, package, settings, or persistence changes are needed.

## Validation Criteria

- [ ] Empty startup and final close have no tabs, CodeMirror, or Vim badge.
- [ ] Empty Viewer renders `ORBIT` and `Ctrl-w f to open a note`.
- [ ] First file opens into the first active buffer.
- [ ] `pnpm check`, `pnpm test`, and `pnpm build` pass.

## Open Questions

None.
