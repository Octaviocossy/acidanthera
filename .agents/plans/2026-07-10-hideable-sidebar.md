# Plan: Hideable Sidebar

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #38

## Goal

Let the user hide and show the sidebar region, reclaiming its 240px rail for the viewer, via
`Ctrl-w b` or a StatusBar toggle — without breaking the app-level focus state machine.

## Context

**What exists today.** The app shell (#10) is a three-region focus state machine in
`useAppStore`: `activeRegion: 'sidebar' | 'viewer' | 'chat'`. Exactly one region is already
hideable — the chat, gated by `chatOpen`:

- `reachableRegions(chatOpen)` filters `'chat'` out of `REGION_ORDER` when closed, so
  `Ctrl-w h`/`l` skip it.
- `closeChat()` reassigns `activeRegion` to `'viewer'` if the chat was focused.
- `ChatPanel` self-guards with `if (!chatOpen) return null` **after** its hooks.
- `AiFab` is the mouse entry point; `Ctrl-w c` is the keyboard one.

The sidebar has no such gate: `Sidebar` always renders its `w-[var(--rail-sidebar)]` rail.

**Trigger.** Issue #38 — `feat: hideable sidebar`.

**Constraint.** This slice was executed headlessly with no access to the issue body (GitHub
tools disabled for the runner) and no pre-existing plan file. The design is derived from the
issue title plus the `chatOpen` precedent, which is treated as the normative pattern for
"a region that can be hidden". Any divergence from the issue body should be reconciled on review.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/stores/app-store.ts` | Add `sidebarOpen` + `open/close/toggleSidebar`; generalize `reachableRegions` |
| MODIFY | `src/components/layout/Sidebar.tsx` | Render `null` while hidden (after hooks) |
| MODIFY | `src/hooks/use-global-keymap.ts` | `Ctrl-w b` → `toggleSidebar` |
| MODIFY | `src/lib/editor/region-exit.ts` | Same chord at CM6 `Prec.highest` |
| MODIFY | `src/components/layout/StatusBar.tsx` | `sidebar` toggle button (mouse entry point) |
| MODIFY | `.agents/ubiquitous-language.md` | New term, relationships, changelog |
| CREATE | `.agents/plans/2026-07-10-hideable-sidebar.md` | This plan |

## Step-by-Step Implementation

**Step 1 — Generalize the reachable-region filter**

- **File:** `src/stores/app-store.ts` · **Action:** MODIFY
- **Details:** Replace `reachableRegions(chatOpen: boolean)` with
  `reachableRegions({ sidebarOpen, chatOpen }: Pick<AppState, 'sidebarOpen' | 'chatOpen'>)`,
  filtering `'sidebar'` on `sidebarOpen` and `'chat'` on `chatOpen`. Call it as
  `reachableRegions(get())` from `focusRegion`/`focusNext`/`focusPrevious`.
- **Why:** `viewer` is unconditionally reachable, so the list is never empty and the modulo
  arithmetic in `focusNext`/`focusPrevious` stays total.

**Step 2 — Add the visibility state + actions**

- **File:** `src/stores/app-store.ts` · **Action:** MODIFY
- **Details:** `sidebarOpen: true` (shown by default). `openSidebar`, `closeSidebar`,
  `toggleSidebar` mirroring the chat trio exactly. `closeSidebar` reassigns
  `activeRegion: state.activeRegion === 'sidebar' ? 'viewer' : state.activeRegion`.
- **Why:** Hiding the focused region must move focus, or the state machine holds an
  unreachable `activeRegion` and `focusNext`'s `indexOf` returns `-1`.

**Step 3 — Guard the Sidebar render**

- **File:** `src/components/layout/Sidebar.tsx` · **Action:** MODIFY
- **Details:** Select `sidebarOpen`; `if (!sidebarOpen) return null;` placed *after* every hook
  (both `useEffect`s and `useSidebarKeymap`), before `flattenVisibleTree`.
- **Why:** Matches `ChatPanel`. The component stays mounted, so the `vault-changed` watcher
  subscription and tree refetch keep running and re-showing is instant. `useSidebarKeymap`
  stays registered but is inert — a hidden sidebar can never be `activeRegion` (Step 2).

**Step 4 — Wire the `Ctrl-w b` chord in both keymaps**

- **Files:** `src/hooks/use-global-keymap.ts`, `src/lib/editor/region-exit.ts` · **Action:** MODIFY
- **Details:** Add `case 'b': ... store.toggleSidebar()` to each `awaitingCtrlW` switch. In
  `region-exit.ts` also `event.stopPropagation()` and `return true`, as its siblings do.
- **Why:** The chord must work whether focus is on the editor or elsewhere (doc/v0-spec.md §3.4
  "CodeMirror coexistence rule"). `stopPropagation` keeps the window-level listener from
  double-handling and toggling twice.

**Step 5 — StatusBar toggle button**

- **File:** `src/components/layout/StatusBar.tsx` · **Action:** MODIFY
- **Details:** A `Button` beside `settings`: `variant={sidebarOpen ? 'ghost' : 'quiet'}`,
  `aria-pressed={sidebarOpen}`, `aria-label` of `Hide sidebar` / `Show sidebar`.
- **Why:** Without a mouse affordance a hidden sidebar is only recoverable by chord. `ghost`
  (`text-text`) vs `quiet` (`text-text-dim`) signals state monochromatically, keeping the
  reserved lime accent on `AiFab` alone (doc/v0-spec.md §5.6 accent discipline).

**Step 6 — Glossary**

- **File:** `.agents/ubiquitous-language.md` · **Action:** MODIFY
- **Details:** New "Sidebar visibility" term; amend the `App store`, `Global keymap` and
  `Region exit (editor)` rows for the `b` chord; add relationships + a changelog row; bump
  "Last updated".

## Architecture Decisions

- **`sidebarOpen` lives on `useAppStore`, not `useSidebarStore`.** It gates a `FocusRegion`, so
  the focus state machine must read it; `useSidebarStore` owns tree/cursor data only. This is
  exactly where `chatOpen` lives, for the same reason.
- **Not persisted to `settings.json`.** `chatOpen` isn't either — both are per-session view
  state, not user preferences. Persisting would mean a Rust `Settings` field, a serde default,
  and a bootstrap write. Deliberately deferred; trivially addable later if the issue wants it.
- **`return null`, not a width/opacity transition.** `ChatPanel` sets the precedent, and the
  motion tokens are "fades only, no bounce" — an animated 240px collapse would be the only
  layout animation in the app.
- **Chord letter `b`.** `h`/`l`/`c`/`s` are taken; `b` carries VS Code's `Cmd-B` muscle memory.
  (This `Ctrl-w` chord family already departs from literal vim window commands — `c` is vim's
  *close*, `s` its *split*.)

## Validation Criteria

- [x] `pnpm lint` passes
- [x] `pnpm build` passes (`tsc` + vite)
- [ ] Manual: `Ctrl-w b` hides the sidebar; the viewer expands to fill the rail
- [ ] Manual: `Ctrl-w b` from inside the editor toggles once, not twice (propagation stopped)
- [ ] Manual: hiding while the sidebar is focused moves `activeRegion` to `viewer` (StatusBar left label)
- [ ] Manual: while hidden, `Ctrl-w h`/`l` cycle only `viewer` (+ `chat` when open) — never `sidebar`
- [ ] Manual: the StatusBar `sidebar` button toggles, brightens when shown, and restores a hidden sidebar
- [ ] Manual: a file created by the agent while the sidebar is hidden appears immediately on re-show

## Open Questions

- **The issue body was never read** (headless run, GitHub tools disabled, no linked plan). If #38
  specified a different chord, a persisted preference, or an animated collapse, this
  implementation must be reconciled with it on review.
- Should `sidebarOpen` be persisted in `settings.json` alongside `theme`/`editorFont`? Deferred
  per the `chatOpen` precedent — see Architecture Decisions.
