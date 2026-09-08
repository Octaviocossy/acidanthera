# Spec: Sidebar Tooltip Primitive

> Status: **settled**
> Created: 2026-09-06
> Grilled: 2026-09-06 — 4 rounds, 14 decisions
> Suggested next: /create-issue

## Goal

Give the sidebar a drawn hover reveal. `FileTreeItem` truncates its label (`min-w-0 truncate`)
and carries nothing to reveal the rest, making it the only clipped surface in the app with no
hover reveal at all — while `FileFinder`, `SettingsDialog`, `DeleteEntryDialog` and the sidebar
footer all already follow the truncate-plus-`title` idiom. Rather than extend that idiom a fifth
time, build the `Tooltip` primitive three prior specs each deferred, and adopt it across the
sidebar.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Mechanism | A hand-rolled `Tooltip` in `src/components/ui/` | ADR 0013's argument transfers verbatim — a native surface "cannot carry the token vocabulary, cannot be tested in jsdom", and the line falls between platform chrome and this app's content. The "no primitive exists" reason the three prior specs each gave is circular. |
| 2 | Not Radix | `@radix-ui/react-tooltip` rejected | `@radix-ui/react-slot` is already installed, but that is a composition helper; the tooltip package adds popper, floating-ui, portal and presence to buy clamp math `SidebarContextMenu` already implements in ~40 lines. |
| 3 | Content | The untruncated value of what got truncated, nothing more | Matches what all four existing sites do. `entry.name` is the **stem** (`vault.rs` calls `file_stem`), so a note reads `readme`, never `readme.md`. |
| 4 | Not metadata | No size, no modified time | `VaultEntry` carries neither in either language and `build_tree_at` never calls `entry.metadata()`. That is a different feature wearing a tooltip's clothes. |
| 5 | Scope | The whole sidebar — 10 of the 16 native `title` sites | Smallest scope with no visible seam inside one region. A themed panel on a rail glyph beside an OS box on the button 20px above it is worse than either alone. |
| 6 | Name | `Tooltip`; a native one is called a `title` | All three prior specs already used "tooltip primitive" for exactly this absent thing, so the word makes those deferrals read as fulfilled. `Hint` was rejected — it collides with `Kbd`, already "a key hint". |
| 7 | Trigger | Hover only | `FileTreeItem` has no `tabIndex` by design (two biome-ignore comments justify region-scoped keys over per-row DOM focus), and a reveal firing on every `j` is noise. |
| 8 | Timing | 500ms, then instant within a ~300ms warm window after one closes | Prevents both failure modes: no cascade down a 20-row tree, no re-wait sweeping the rail's stacked 24px glyphs — the case where an unlabelled glyph most needs it. |
| 9 | Placement | Right edge of the target, vertically centered, clamped to its layer | Reads as a continuation of the clipped label; the canvas to the right always exists since the sidebar hugs the window's left edge; one rule serves both the 224px tree and the 40px rail. Below-placement would cover the next row. |
| 10 | Mount point | `Layout`'s `relative` row, as `SidebarContextMenu` does | The sidebar body is `overflow-y-auto` inside an `overflow-hidden` row, so a tooltip rendered in place would clip. |
| 11 | Truncation | Text rows only when clipped (`scrollWidth > clientWidth`, measured at hover); icon targets always | A panel fading in to say `readme` over a row already reading `readme` is noise. Icon targets have no visible label to be redundant with. Measured at hover, not at mount — sidebar width is a fixed rail and a row's indent is fixed by its depth, so a per-row `ResizeObserver` would buy nothing. |
| 12 | Panel treatment | One step lighter than the context menu: `--radius-item`, `--border`, `--bg-elevated`, `--shadow-popover-light` in light theme only | Honors "dark = borders only; light = soft warm shadows" and gives that orphan token its first consumer. A passive 20px hover panel should not carry a 210px actionable menu's `--border-strong`. |
| 13 | No new radius token | `--radius-tooltip` rejected | The ladder already has eight steps and a tooltip is item-shaped; a rung for a few pixels inflates the vocabulary invariant 22 keeps tight. |
| 14 | Dismissal | pointerleave, capture-phase scroll, window blur, any mousedown, and whenever a modal overlay is pushed | The three listeners `SidebarContextMenu` already installs, plus overlay awareness so it never floats above a menu that just opened over it. |
| 15 | Not a modal layer | `pushModalOverlay` deliberately **not** called | Invariant 25 has an active modal layer absorb every keydown, matched or not — registering would make `j`/`k`/`a`/`A` inert while the pointer merely rests on a row. It therefore forgoes Escape-to-dismiss. |
| 16 | Store-free | `content` is a `ReactNode`; anything store-derived is resolved by the caller | The glossary defines primitives as store-free and names `Modal` "the one primitive with a side effect". `Tooltip` is not made a second exception. |
| 17 | Chord hints | Label plus a real `<Kbd>`, composed at the `Sidebar` call site from the resolved keymap | A drawn panel can render the boxed key hint the design system already has — the capability drawing it buys. A `label (chord)` string cannot. |
| 18 | Ownership vs. *keymap reference* | Partitioned, not sequenced: `Tooltip` takes the sidebar's 6 chord-bearing controls, `chordTitle` keeps the titlebar's 2 | Both honor invariant 31, which fixes the chord's *source* as the resolved keymap and says nothing about its rendering. Sequencing would rewrite the same 9 call sites twice and add a dependency on an unshipped branch. |
| 19 | Terminology | "Tooltip" names the drawn primitive only | Invariant 31 and the *chord hint* row called native `title` strings "chrome tooltips"; leaving the word meaning both an OS attribute and a React component plants a homonym inside an invariant. |
| 20 | ADR | One, not two | ADR 0034 carries the mechanism, the surviving-native boundary, the partition, and the not-a-modal-layer consequence. `adr.md` warns a directory full of ADRs is worth less than three good ones. |

## Explicitly Out of Scope

- **The 6 native `title` sites outside the sidebar.** The titlebar's two buttons, `FileFinder`,
  `SettingsDialog`, `DeleteEntryDialog`, and the context menu's `"Coming soon"` keep native
  `title`. The boundary is a mixed vocabulary *within* one region — not a half-finished
  migration. Completing it app-wide is its own piece of work.
- **`chordTitle`, `formatChords`, and the keymap reference table.** Owned by the concurrent
  `.agents/specs/2026-09-06-keymap-reference.md`. This work consumes the resolved keymap
  directly via the existing `formatChord`; it does not build or modify those helpers.
- **Keyboard-triggered reveal.** No tooltip on the `j`/`k` sidebar cursor, and no `tabIndex` is
  added to `FileTreeItem`.
- **Escape-to-dismiss**, and any registration as a modal layer.
- **File metadata** in the reveal — no `VaultEntry` change in either language.
- **Vault-relative or absolute paths** on tree rows. The tree's indentation already encodes
  location.
- **`InlineNameInput` and `EntryDraftRow`.** Rows being typed into get no tooltip.
- **A `--radius-tooltip` token**, and any other new design token. `--shadow-popover-light`
  already exists and is merely unconsumed.
- **`@radix-ui/react-tooltip`** or any new dependency.

## Glossary Changes

Written inline during the session:

- **Added** *Tooltip* to Cross-cutting presentation vocabulary — mechanism, content rule,
  truncation condition, trigger, timing, placement, mount point, panel treatment, dismissal,
  and the store-free rule.
- **Added invariant 32** — a clipped surface carries a hover reveal, inside the sidebar it is
  drawn, and the `Tooltip` is deliberately not a modal layer. This **renumbered the Scaffold
  and orchestration block 32–49 → 33–50**, and its four internal cross-references with it.
- **Amended** *Root entry* — "there is no tooltip primitive in the repo" is now false.
- **Amended** *design primitive* — `Tooltip` joins the roster, with an explicit note that it is
  not a second store-touching exception beside `Modal`.
- **Amended** *chord hint* and **invariant 31** — both called native `title` strings "chrome
  tooltips"; the word is now reserved for the drawn primitive, and `chordTitle`'s scope is
  corrected to the titlebar's two controls.
- Section marker added; `Last updated` bumped to 2026-09-06; Changelog row added.

## ADRs Raised

- `.agents/adr/0034-sidebar-hover-reveal-is-app-drawn.md` — The sidebar's hover reveal is
  app-drawn

## Residual Unknowns

The concurrent *keymap reference* work is **uncommitted in the working tree**, and this session
edited two of its glossary lines for decision 19. Decision 18 partitions the two rather than
ordering them, so neither blocks the other — but if that spec's scope changes to claim the
sidebar's six chord-bearing controls, the partition must be revisited before either lands.
