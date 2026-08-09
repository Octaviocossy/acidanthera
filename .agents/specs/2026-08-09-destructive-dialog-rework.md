# Spec: Destructive Dialog Rework — `Modal` Shell and a Danger Role

> Status: **settled**
> Created: 2026-08-09
> Grilled: 2026-08-09 — 3 rounds, 17 decisions
> Suggested next: /create-issue

## Goal

Rebuild the "Move to Trash?" confirmation to the design in the mockup — icon tile, sans title, the
path in its own field, a filled red confirm button, key hints and a softer panel — and, because the
same panel markup is duplicated verbatim across three dialogs, do it by extracting the shared
`Modal` shell those three then share.

## Context that shaped the decisions

Five facts, established by exploration before any question was asked:

1. **No red exists anywhere in the token layer.** No `--danger`, `--destructive`, `--error`. The
   only red hexes are `--mac-red` and `--diff-del-*`, both with **zero consumers**. Four
   independent sites converged on the same monochrome kit for failure — `border-border-strong` plus
   a tracked-caps mono tag — and `ToastHost`'s docblock states the rule outright: *"no color"*.
2. **The previous spec chose the opposite, one day earlier.**
   `.agents/specs/2026-08-09-sidebar-context-menu.md` decision 15: *"Destructive affordance — **No
   color**"*. This spec reverses it, which is why it carries an ADR rather than a styling note.
3. **No shared dialog primitive exists.** `absolute inset-0 … bg-[var(--scrim)]` and
   `rounded-modal border border-border-strong bg-surface p-4 shadow-[…]` are duplicated verbatim
   across `DeleteEntryDialog`, `SwitchVaultDialog` and `CloseBufferDialog`, as is the
   `mt-4 flex justify-end gap-2` footer. `src/components/ui/dialog.tsx` does not exist and no
   headless dialog library is installed.
4. **Only one shadow token is alive.** `--shadow-overlay-dark` (`0 24px 64px rgba(0,0,0,0.5)`) on
   all five overlay panels; the other four tokens, including the entire light half, have no
   consumers, and none are mapped into Tailwind's `@theme`. The recent direction of travel was
   shadow *removal* (`.agents/plans/2026-08-09-remove-sidebar-menu-shadow.md`).
5. **Two dialogs are not escapable at all.** `CloseBufferDialog` and `SwitchVaultDialog` never call
   `pushModalOverlay`, so Escape does nothing in them and region chords stay live under their
   scrims — the gap ADR 0014 recorded as known and deferred. Extracting a shell makes fixing it
   nearly free, which is why it was reopened here.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Scope | Extract a shared `Modal`; adopt it in `DeleteEntryDialog`, `CloseBufferDialog`, `SwitchVaultDialog`. `SettingsDialog` and `FileFinder` keep their structure and take only the chrome tokens | Their markup is byte-identical today, so migrating is nearly free — and restyling only one leaves two modal languages in the app at once |
| 2 | Primitive name | `Modal` (`src/components/ui/modal.tsx`) | The app's `modal` vocabulary is already load-bearing (`KeymapLayer 'modal'`, `pushModalOverlay`, `--radius-modal`) and this shell is what registers that layer. "The `Dialog` registers the `modal` layer" needs two words for one thing |
| 3 | Keyboard ownership | The shell calls `pushModalOverlay` with `onCancel` **always**, `onConfirm` only when the dialog has one unambiguous confirm action | Makes the two unescapable dialogs escapable and stops them leaking region chords, without inventing a meaning for `⏎` in a Save/Discard/Cancel dialog |
| 4 | Focus and scrim | Focus the **panel** (`tabIndex={-1}`), as `SettingsDialog` already does; scrim inert | Focusing Cancel — the conventional choice — collides: `⏎` would fire its native click *and* `modal.confirm`, two opposite outcomes on one key. An inert scrim is correct for a destructive dialog: a stray click must neither cancel nor confirm |
| 5 | Confirm button | Filled, on a new `Button` `danger` variant | Today it is `secondary` — visually identical to Cancel and to "Change…" in settings. The weight, not just the hue, was the complaint |
| 6 | The color | New `--danger` / `--danger-on` / `--danger-soft`, **not** the ember | `variant="primary"` is `bg-accent`; invariant 21 and ADR 0007 reserve it for AI agency, and deleting a note is the most deliberately human action in the app (ADR 0015) |
| 7 | Values | `--danger` `#d3453f` dark / `#c8372e` light; `--danger-on` `#ffffff`; `--danger-soft` `rgba(211,69,63,0.12)` dark / `#fdecea` light | Tuned to the ember's weight so the app's only two colored fills do not compete |
| 8 | Danger's surface list | The `danger` button and the `--danger-soft` icon tile. **Not** the context menu's Delete item | That item opens a dialog rather than destroying anything; coloring it dilutes the token from "this destroys" to "this is about deleting" |
| 9 | Icon | ~28px `rounded-item` tile, `--danger-soft` fill, hand-drawn trash SVG (viewBox 16, render 15px, stroke 1.2, `currentColor`) | Makes the dialog read as destructive before a word is read. No icon dependency; matches the `glyphs.tsx` house style |
| 10 | Title typography | Sans `text-h2` (15px), weight **500**, sentence case — replacing `SectionLabel` | A dialog title is a heading, not a section rubric. 500 not 600: the skill reserves 600 for strong inline emphasis |
| 11 | The path | Its own bordered `bg-elevated` mono field, rendered through `displayPath`, elided by `truncatePathStart` on overflow | Leading elision keeps the filename, which is the only part worth reading. Also makes the glossary's *vault display path* claim true, which it was not |
| 12 | Body copy | `1 note moves to Trash.` with a concordant verb (`1 note moves` / `2 notes move` / `1 directory and 2 notes move`); the buffers line **only when buffers will actually close** | The path left the sentence, so the counts are now the informative part. Warning about a close that will not happen spends the dialog's only consequences line |
| 13 | Dirty-buffer block | Stays last, after a hairline rule, monochrome | It sits directly above the buttons — the last thing read before clicking — and keeping it there stops the dialog's header reflowing case by case |
| 14 | Footer line | `recoverable from Trash`, no duration | The only claim true on all three platforms; macOS empties after 30 days only if the user enabled it. It is the counterweight to the button's new volume |
| 15 | Key hints | `Cancel esc` / `Move to Trash ⏎` via `Button`'s `kbd` prop, read from the `ResolvedKeymap` | `modal.confirm`/`modal.cancel` are rebindable, so a hardcoded hint can lie. `FileFinder` hardcodes its own and already does |
| 16 | Panel elevation | Hairline border + a soft per-theme shadow: a new, more restrained `--shadow-modal-dark`, the warm light shadow finally activated, exposed as a Tailwind `shadow-modal` utility | In dark the hairline barely reads against `--bg-surface`, so the shadow becomes the separator — which is what the mockup asks for. The current `0 24px 64px/50%` is the "heavy card" being retired |
| 17 | Width | 460px, up from 420 | The new footer needs ~400px of content (recovery line + two buttons + padding); at 420 it is airless and the path field elides almost always |

## Explicitly Out of Scope

- **`--danger` anywhere but the confirm button and its tile.** The list in decision 8 is closed.
  The error toast, `ToolChip`'s error state, the chat error item and the settings syntax diagnostic
  stay monochrome — a failure is not a destruction.
- **Retrofitting `SettingsDialog` and `FileFinder` onto the `Modal` shell.** Their structure
  (header bar, hint row, an input that owns focus) is genuinely different. They take the new chrome
  tokens so elevation is consistent, and nothing else.
- **Making `⏎` mean something in the three-button dialogs.** `CloseBufferDialog` and
  `SwitchVaultDialog` register `onCancel` only.
- **Reviving the four dead shadow tokens** beyond the modal pair actually needed.
- **Rename, multi-select, drag-to-move, in-app undo.** Unchanged from the previous spec.
- **A focus trap.** Panel focus, not a trap; `Tab` may leave the dialog as it does today.

## Glossary Changes

Written into `.agents/ubiquitous-language.md`; both affected sections carry a marker until the work
lands.

- **Added:** *destructive color* (`--danger`), *modal shell* (`Modal`).
- **Amended:** *AI accent* (the second colored fill, tuned to the same weight), *`Button` variant
  and key hint* (a `danger` variant, reserved as narrowly as `primary`), *design primitive*
  (`Modal` joins, and is the one primitive carrying a side effect), *delete confirmation* (a fixed
  presentation contract), *vault display path* (a fourth consumer).
- **Invariant 25** amended: overlay registration is the *modal shell*'s job, not each dialog's,
  which closes the leak for `CloseBufferDialog` and `SwitchVaultDialog`; `SettingsDialog` and
  `FileFinder` stay outside deliberately, each already blocking keys its own way.
- **Invariant 27:** the destructive color marks a click that destroys and nothing else, leaving the
  app exactly two colored fills.

Also fixed in passing: the two "settled ahead of implementation" markers left over from
`.agents/specs/2026-08-09-sidebar-context-menu.md` were removed — that epic landed in PR #122.

## ADRs Raised

- `.agents/adr/0015-destructive-color-is-its-own-role.md` — records that `--danger` is a role
  disjoint from the ember, that a *failure* stays monochrome, and that reusing the ember was
  requested and rejected. It partially supersedes decision 15 of
  `.agents/specs/2026-08-09-sidebar-context-menu.md`, which chose no color at all; that decision
  survives for the context menu's Delete item.

## Residual Unknowns

None — the frontier emptied cleanly.

One thing worth restating rather than rediscovering: decision 12's conditional buffers line and
decision 13's dirty-buffer block are the same disclosure at two volumes. Per the previous spec's
closing note, the unsaved edits are the only genuinely unrecoverable thing this dialog destroys —
the file itself comes back from Finder. If deletion ever stops going to the trash, that block stops
being a detail at the bottom and becomes the dialog's headline.
