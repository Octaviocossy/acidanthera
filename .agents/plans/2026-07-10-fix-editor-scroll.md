# Plan: Fix editor vertical scroll (CodeMirror wrapper has no bounded height)

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none_

## Goal

Restore vertical scrolling in the markdown editor (`Viewer`) so that notes longer
than the viewport can be scrolled instead of being clipped and unreachable. The fix
is a single-line CSS/height change; no behavior or domain change.

## Context

### Current state

`Viewer` (`src/components/layout/Viewer.tsx`) renders the CodeMirror 6 editor via
`@uiw/react-codemirror` (v4.25.10):

```tsx
<main className="relative flex h-full flex-1 flex-col overflow-hidden border-t-2 bg-bg ...">
  <div className="min-h-0 flex-1">
    <CodeMirror value={content} onChange={setContent} extensions={extensions}
      theme="none" height="100%" basicSetup={{ lineNumbers: true, foldGutter: false }} />
  </div>
  ...
</main>
```

The editor is supposed to fill the `min-h-0 flex-1` container and scroll internally.
It does not: long documents overflow and are clipped by `main`'s `overflow-hidden`,
with no scrollbar and no way to scroll to the clipped content.

### Root cause (verified against installed sources)

The height chain from the app root down to the CM6 scroller is:

| Element | Height source | Bounded? |
|---------|---------------|----------|
| `html, body, #root` | `height: 100%` (`src/styles/index.css`) | ✓ |
| `Layout` outer `div` | `h-screen flex-col` | ✓ |
| `Layout` inner `div` | `flex-1 overflow-hidden` (row flex) | ✓ |
| `Viewer` `<main>` | `h-full flex-col` | ✓ |
| `Viewer` inner `<div>` | `min-h-0 flex-1` (column flex child) | ✓ |
| **`.cm-theme-none` wrapper** | **(none — react-codemirror renders a bare `<div>`)** | **✗ breaks here** |
| `.cm-editor` | `height: 100%` (from both `height="100%"` prop and `theme.ts` `'&': { height: '100%' }`) | ✗ (100% of an auto-height parent → collapses to content height) |
| `.cm-scroller` | `height: 100% !important` (react-codemirror default theme) | ✗ (100% of auto → auto → no overflow) |

`@uiw/react-codemirror`'s `ReactCodeMirror` (see `node_modules/@uiw/react-codemirror/esm/index.js`)
renders exactly one wrapper element:

```js
return _jsx("div", { ref: setEditorRef, className: "cm-theme-none" + (className ? " " + className : "") }, other);
```

CodeMirror's `.cm-editor` mounts **inside** that wrapper. The `height="100%"` prop
(see `esm/useCodeMirror.js`) is turned into a theme applied to `.cm-editor` (`'&'`), plus
`'& .cm-scroller': { height: '100% !important' }` — but **nothing sets a height on the
`.cm-theme-none` wrapper itself**. A CSS percentage height resolves against the parent's
height; because the wrapper is a plain block `div` with `height: auto`, `.cm-editor`'s
`height: 100%` computes to `auto`, so the editor grows with its content and the scroller
never has a bounded box to overflow.

The `min-h-0 flex-1` container above the wrapper **is** correctly bounded (standard flex
pattern), so the only missing link is the wrapper element. Giving that wrapper
`height: 100%` reconnects the chain: wrapper → 100% of the bounded flex container →
`.cm-editor` 100% of the bounded wrapper → `.cm-scroller` 100% of the bounded editor →
`overflow: auto` (CM6 stock base theme) produces the scrollbar.

### Constraints

- Do **not** remove `EditorView.lineWrapping` (#37) — horizontal scrolling is intentionally
  disabled; this fix only concerns vertical scroll.
- Keep the module-level `BASE_EXTENSIONS` / memoized `editorTheme` structure intact
  (recreating extensions per render reconfigures CM6 state, per the comment in `Viewer.tsx`).
- CSS-only / layout-only fix — no new domain entity, state, or process, so
  `.agents/ubiquitous-language.md` does **not** need an update (the `Viewer` entry already
  describes the component).

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/layout/Viewer.tsx` | Add `className="h-full"` to `<CodeMirror>` so the `.cm-theme-none` wrapper gets a bounded height and the scroller can overflow. |

## Step-by-Step Implementation

> **Step 1 — Give the react-codemirror wrapper a bounded height**
>
> - **File:** `src/components/layout/Viewer.tsx`
> - **Action:** MODIFY
> - **Details:**
>   - On the `<CodeMirror ... />` element (currently line 43), add a `className="h-full"`
>     prop. `@uiw/react-codemirror` appends any `className` to its wrapper `div`, so the
>     wrapper becomes `class="cm-theme-none h-full"` (`h-full` = `height: 100%`).
>   - Before:
>     ```tsx
>     <CodeMirror value={content} onChange={setContent} extensions={extensions} theme="none" height="100%" basicSetup={{ lineNumbers: true, foldGutter: false }} />
>     ```
>   - After:
>     ```tsx
>     <CodeMirror className="h-full" value={content} onChange={setContent} extensions={extensions} theme="none" height="100%" basicSetup={{ lineNumbers: true, foldGutter: false }} />
>     ```
>   - Keep the `height="100%"` prop: it (and `theme.ts`'s `'&': { height: '100%' }`) is what
>     sizes `.cm-editor` to 100% of the now-bounded wrapper. Removing it would re-break the
>     chain one level lower.
> - **Why:** The wrapper `div` is the one element in the height chain with no bounded height;
>   `h-full` resolves it against the already-bounded `min-h-0 flex-1` container, restoring the
>   percentage-height chain so `.cm-scroller` overflows and scrolls.

> **Step 2 — (Optional hardening) update the height-chain comment**
>
> - **File:** `src/components/layout/Viewer.tsx`
> - **Action:** MODIFY (optional; do only if adding a clarifying note)
> - **Details:** If desired, add a short note near the JSX explaining that `className="h-full"`
>   is required because react-codemirror's `.cm-theme-*` wrapper otherwise has no height,
>   which would collapse `.cm-editor`'s `height: 100%`. Keep it to one or two lines, matching
>   the terse comment style already in the file.
> - **Why:** Prevents a future edit from "cleaning up" the seemingly-redundant `h-full` and
>   silently reintroducing the bug.

## Architecture Decisions

- **Fix at the wrapper via `className`, not global CSS.** `@uiw/react-codemirror` forwards
  `className` to its wrapper element, so `className="h-full"` is the most local, idiomatic
  fix and stays consistent with the codebase's Tailwind-utility approach. Alternatives
  considered:
  - *Global rule `.cm-theme-none { height: 100% }` in `src/styles/index.css`* — works, but
    couples an app-wide stylesheet to a third-party wrapper class and is less discoverable
    from `Viewer.tsx`.
  - *Set height only in `theme.ts`* — CM6 themes target `.cm-editor`/descendants via `&`;
    they cannot style the outer `.cm-theme-none` wrapper (it is not part of the EditorView
    DOM), so this cannot fix the missing link.
- **Keep `height="100%"` and `lineWrapping`.** Both are still required: `height="100%"` sizes
  `.cm-editor` inside the now-bounded wrapper; `lineWrapping` (#37) keeps horizontal scroll
  off. This change is additive.
- **No domain/glossary change.** Layout-only fix to an existing entity (`Viewer`); no new
  term, state, or contract, so `.agents/ubiquitous-language.md` is untouched (per
  `.agents/rules/domain-glossary.md`, only new entities/states/processes require an update).

## Validation Criteria

- [x] `pnpm build` passes (TypeScript + Vite).
- [x] `pnpm lint` passes.
- [x] Manual smoke test in `pnpm dev`:
  - [x] Open (or create) a note with more lines than fit the editor viewport.
  - [x] A vertical scrollbar appears inside the editor region.
  - [x] Mouse-wheel / trackpad scrolling moves the content; the last line is reachable.
  - [x] Vim `gg` (go to start) scrolls the viewport to the cursor (verified; `G`/`shift+g`
        wasn't reliably deliverable through the browser automation harness, but wheel-scroll
        to the last line and `gg` back to the first both worked).
  - [ ] Resizing the window keeps the editor filling its region and scrolling correctly. (not
        exercised — dev smoke test was done in a fixed-size browser tab)
  - [x] No horizontal scrollbar appears for long single lines (line wrapping still on, #37).
  - [x] Line numbers gutter still renders and scrolls with the content.
  - [ ] Toggling the chat panel / sidebar (which changes the viewer width/height) keeps
        scrolling working. (not exercised in this smoke test)

## Open Questions

None.
