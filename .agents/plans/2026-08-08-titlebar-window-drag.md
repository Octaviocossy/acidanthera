# Plan: Fix titlebar window dragging

> Status: **in-progress**
> Created: 2026-08-08
> Updated: 2026-08-08

## Goal

Make the app-drawn titlebar drag the window again, by granting the Tauri window-drag permission the
capability file never had and by widening the drag region so the titlebar's control cluster is not a
dead zone.

## Context

Clicking and dragging the app-drawn titlebar does not move the window.

`Titlebar` (`src/components/layout/Titlebar.tsx`) landed in #105 with `titleBarStyle: "Overlay"` +
`hiddenTitle` (ADR 0008), which puts the webview under the full window height — so the OS no longer
drags the window for us and Tauri's `data-tauri-drag-region` shim has to. **Two independent defects
stop it**, both confirmed against the resolved ACL and the shipped shim, not inferred:

**1. The `start_dragging` command is denied by the ACL — this alone blocks all dragging.**
`src-tauri/capabilities/default.json` grants `core:default`, which expands (verified in
`src-tauri/gen/schemas/acl-manifests.json`) to a `core:window:default` set of 28 permissions. It
contains `allow-internal-toggle-maximize` but **not** `allow-start-dragging`. The shim's
`invoke('plugin:window|start_dragging')` is rejected. Diagnostic tell: double-clicking the titlebar
to zoom *does* work, because that path uses `internal_toggle_maximize`, which *is* granted.

ADR 0008 predicted exactly this and it was never acted on: *"`src-tauri/capabilities/default.json`
grants no window permissions beyond whatever `core:default` covers, so anything that
programmatically moves, resizes or decorates the window needs an explicit permission added there."*
`git log` confirms the file has not been touched since before the titlebar existed.

**2. Bare `data-tauri-drag-region` means "self-only" in Tauri 2.11.5.**
The shim (`~/.cargo/registry/.../tauri-2.11.5/src/window/scripts/drag.js`) walks the composed path:

```js
if (attr === 'deep') return true                                    // subtree drag
if (attr === '' || attr === 'true') return el === composedPath[0]   // SELF ONLY
```

The `<header>` carries the bare attribute, so a mousedown only drags when the header *itself* is the
event target. The centered title band is `pointer-events-none`, so it correctly falls through — but
the right-hand control cluster `<div className="relative ml-auto mr-2 flex items-center gap-1">` is a
real hit target with no attribute, so its padding and the `gap-1` between the two buttons are a dead
zone. The `<Button>`s themselves are in the shim's `CLICKABLE_TAGS` set and block drag regardless,
which is the behavior we want.

Versions: `tauri` 2.11.5 (Cargo.lock), `@tauri-apps/api` 2.11.1.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src-tauri/capabilities/default.json` | Add `core:window:allow-start-dragging` |
| MODIFY | `src/components/layout/Titlebar.tsx` | `data-tauri-drag-region` → `="deep"` |
| MODIFY | `src/components/layout/Titlebar.test.tsx` | Regression guard on the attribute |
| MODIFY | `.agents/ubiquitous-language.md` | Correct the *Titlebar* entry's drag sentence |

## Step-by-Step Implementation

**Step 1 — Grant the window-drag permission**

- **File:** `src-tauri/capabilities/default.json`
- **Action:** MODIFY
- **Details:** add `"core:window:allow-start-dragging"` to the `permissions` array, after
  `"core:default"`:

```json
"permissions": [
  "core:default",
  "core:window:allow-start-dragging",
  "core:event:default",
  "opener:default",
  "dialog:default",
  "clipboard-manager:allow-write-text"
]
```

- **Why:** the shim's `start_dragging` invoke is currently rejected by the ACL. This is the fix that
  actually restores dragging; step 2 only widens where it works.

**Step 2 — Make the whole header subtree a drag region**

- **File:** `src/components/layout/Titlebar.tsx`
- **Action:** MODIFY
- **Details:** change the bare attribute on the `<header>` to an explicit `deep`:

```tsx
<header
  data-tauri-drag-region="deep"
  className="relative flex h-[var(--rail-titlebar)] shrink-0 items-center border-b border-hairline bg-surface"
>
```

  Change nothing else. Do **not** add the attribute to the control-cluster `<div>` or to any
  `<Button>` — `deep` covers the div, and the shim already exempts buttons.
- **Why:** with the bare (self-only) attribute the control cluster's padding and inter-button gap are
  a dead zone; `deep` is the 2.11.x idiom for "drag anywhere in here except the clickable bits".

**Step 3 — Add the regression guard**

- **File:** `src/components/layout/Titlebar.test.tsx`
- **Action:** MODIFY
- **Details:** append one `it` inside the existing `describe('Titlebar')`, matching the file's style
  (explicit `vitest` imports, `screen` queries):

```tsx
it('marks the whole titlebar as a window drag region', () => {
  render(<Titlebar />);

  expect(screen.getByRole('banner')).toHaveAttribute('data-tauri-drag-region', 'deep');
});
```

  `<header>` maps to the implicit ARIA role `banner`, so this needs no test id. `toHaveAttribute`
  comes from `@testing-library/jest-dom/vitest`, already wired in `src/test/setup.ts`.
- **Why:** nothing currently asserts the attribute exists, so a re-skin can silently delete it — which
  is a class of bug that produces no test failure and no console error.

**Step 4 — Correct the glossary**

- **File:** `.agents/ubiquitous-language.md`
- **Action:** MODIFY
- **Details:** in the *Titlebar* row of the "Cross-cutting presentation vocabulary" table, replace the
  trailing sentence (which documents the now-changed contract) with one describing `deep` plus the
  permission requirement. Set `Last updated:` to `2026-08-08` and add a Changelog row.
- **Why:** `.agents/rules/domain-glossary.md` requires the glossary to describe current behavior.

## Architecture Decisions

- **`deep` over per-element attributes.** The alternative minimal fix — keeping the bare attribute and
  adding a second one to the control-cluster `<div>` — works but scales badly: every future titlebar
  wrapper would need its own attribute. `deep` states the intent once ("this whole bar drags") and the
  shim's `CLICKABLE_TAGS`/`INTERACTIVE_ROLES` exemption keeps the buttons clickable for free.
- **Not granting `core:window:allow-start-resize-dragging`.** `decorations` is left at its default
  `true`, so macOS still owns the resize borders; there are no custom resize handles to authorize.
  Granting unused window permissions widens the ACL for nothing.
- **No ADR.** Each change is one line, trivially reversible, with no rejected alternative worth
  remembering. ADR 0008 already records the titlebar decision and even flagged this permission
  consequence.

## Validation Criteria

- [x] `pnpm test` — 275 tests across 40 files pass, including the new attribute assertion.
- [x] `pnpm build` (tsc + vite) passes.
- [x] `pnpm check` (biome lint + format) passes.
- [x] `cargo build --manifest-path src-tauri/Cargo.toml` passes and
      `src-tauri/gen/schemas/capabilities.json` regenerates with `core:window:allow-start-dragging`
      in the resolved ACL. (tauri-build hard-errors on an unknown permission identifier, so a green
      build also confirms the identifier is spelled correctly.)
- [ ] **Manual smoke — the only check that proves the real fix.** `pnpm tauri dev` (note: `pnpm dev` is
      vite-only and cannot exercise the drag shim). A full Rust rebuild is required for the
      regenerated ACL to take effect; restart the app if it was already running. Then:
  - [ ] Drag from empty titlebar space → the window moves.
  - [ ] Drag from the gap between the `⌕` and `⚙` buttons → the window moves (what step 2 buys).
  - [ ] Click `⌕` → file finder opens; click `⚙` → settings opens. Neither drags the window.
  - [ ] With the sidebar hidden, click the `›` re-show button → sidebar returns, window does not drag.
  - [ ] Double-click the titlebar → window zooms (must still work; it did before).
  - [ ] Traffic lights still hit-test correctly at the top-left.

## Open Questions

None.
