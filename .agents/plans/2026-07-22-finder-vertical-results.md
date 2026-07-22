# Plan: Vertical File Finder Results

> Status: **completed**
> Created: 2026-07-22
> Updated: 2026-07-22
> Issue: N/A

## Goal

Render every file-finder result as one full-width row beneath the prior result, rather than allowing option buttons to flow horizontally and wrap. Keep long paths on a single line with an ellipsis.

## Context

- `FileFinder` renders result options as `<button>` elements inside a `role="listbox"` container.
- The current listbox does not establish a vertical flex layout and the option buttons lack a full-width display constraint, so results can appear beside one another.
- The user selected single-line truncation for paths longer than the finder panel.
- The UI must retain its current dialog, combobox, listbox, option, mouse-selection, cursor, and keyboard-navigation behavior.
- This is a presentation-only change; no file-search ranking, finder-store, domain contract, glossary, or backend change is needed.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/layout/FileFinder.tsx` | Force a vertical result list and truncate long option labels |
| MODIFY | `src/components/layout/FileFinder.test.tsx` | Cover multiple vertical result rows and long-path presentation contracts |

## Step-by-Step Implementation

1. **Make the listbox a vertical stack.**

   - **File:** `src/components/layout/FileFinder.tsx`
   - **Action:** MODIFY
   - **Details:** Update the result-list container at the existing `role="listbox"` to include Tailwind layout utilities equivalent to:

     ```tsx
     className="flex max-h-80 flex-col overflow-y-auto py-1"
     ```

     Keep the existing stable `id`, `role="listbox"`, accessible name, height limit, scrolling behavior, and empty-results message.
   - **Why:** A column flex container guarantees that every option occupies a distinct vertical list row.

2. **Make each option a full-width single-line row.**

   - **File:** `src/components/layout/FileFinder.tsx`
   - **Action:** MODIFY
   - **Details:** Extend each result button's class list with:

     ```tsx
     "w-full min-w-0 truncate text-left"
     ```

     Preserve the existing `role="option"`, `aria-selected`, selected/unselected color classes, pointer behavior, `onMouseMove`, and `onClick` handlers. Add:

     ```tsx
     title={candidate.relativePath}
     ```

     to expose the untruncated relative path through the native tooltip.
   - **Why:** Full-width buttons prevent inline flow; `truncate` avoids multi-line rows while `title` retains access to the complete path.

3. **Expand component fixtures to include multiple and long paths.**

   - **File:** `src/components/layout/FileFinder.test.tsx`
   - **Action:** MODIFY
   - **Details:** In `beforeEach`, seed `useSidebarStore.tree` with at least two Markdown files, including one nested path long enough to exercise the row-label contract. Keep using the real Zustand stores and mock only `openVaultFile` as the existing test does.
   - **Why:** One candidate cannot detect a layout regression where sibling options flow onto the same line.

4. **Assert the vertical and truncation presentation contract.**

   - **File:** `src/components/layout/FileFinder.test.tsx`
   - **Action:** MODIFY
   - **Details:** Add one observable component test that opens the finder and retrieves the listbox and both options by role. Assert:

     ```ts
     expect(listbox).toHaveClass("flex", "flex-col");
     expect(option).toHaveClass("w-full", "min-w-0", "truncate", "text-left");
     expect(longPathOption).toHaveAttribute("title", longRelativePath);
     ```

     Retain the existing tests that cover recursive discovery and Enter-based opening, updating their fixture expectations only if the added path changes the ranking order.
   - **Why:** These classes and tooltip attribute are the direct, user-observable CSS contract for vertically stacked, single-line rows.

5. **Validate the isolated UI change.**

   - **Files:** no additional source files
   - **Action:** VERIFY
   - **Details:** Run `pnpm check`, `pnpm test`, and `pnpm build`. Manually verify with a vault containing multiple nested notes that rows are vertically stacked, a selected row spans the panel width, long paths ellipsize instead of increasing row height, hovering exposes the full path, and keyboard selection still opens the expected note.
   - **Why:** The change is style-local but sits on the finder interaction path, so both visual and behavioral checks are required.

## Architecture Decisions

- Use the existing native `<button role="option">` controls rather than introducing list items, wrappers, or a new component. This preserves the established listbox semantics and event handling.
- Apply layout constraints directly at the listbox and option boundaries. No global stylesheet rule is needed because the behavior belongs only to the finder.
- Use CSS truncation rather than wrapping. It keeps result row heights stable for keyboard scanning and matches the user-selected behavior.
- Use the browser-native `title` tooltip for the complete relative path rather than adding a new preview UI or dependency.
- Do not update `.agents/ubiquitous-language.md`; no entity, type, state, process, or data contract changes.

## Validation Criteria

- [ ] With two or more matches, every finder option is rendered below the preceding option.
- [ ] Each option spans the available finder width and remains left-aligned.
- [ ] A long relative path is visually single-line and ellipsized rather than wrapped.
- [ ] Hovering a long-path option exposes its complete relative path through `title`.
- [ ] Existing dialog, combobox, listbox, option, mouse-selection, and Enter-open behaviors remain intact.
- [ ] `pnpm check` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.

## Open Questions

None.
