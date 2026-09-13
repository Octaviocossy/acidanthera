# The sidebar's hover reveal is app-drawn

Three settled specs in a row declined to build a tooltip primitive, each giving the same reason —
"there is no tooltip primitive in the repo" — which is circular: it did not exist because each
spec in turn declined to build it. Meanwhile `FileTreeItem` had become the only truncating
surface in the app carrying no hover reveal at all, while `FileFinder`, `SettingsDialog`,
`DeleteEntryDialog` and the sidebar footer all followed the truncate-plus-`title` idiom. The
sidebar now uses a hand-rolled `Tooltip` primitive instead, on ADR 0111's own reasoning: a native
surface "cannot carry the token vocabulary, cannot be tested in jsdom", and the line falls between
platform chrome and this app's own content — a filename reveal is content.

## Considered Options

`@radix-ui/react-tooltip` was rejected despite `@radix-ui/react-slot` already being installed.
Slot is a tiny composition helper; the tooltip package pulls in popper, floating-ui, portal and
presence to buy anchor-and-clamp math that `SidebarContextMenu` already implements in about forty
lines, against a layer this app positions by hand.

## Consequences

**Native `title` deliberately survives outside the sidebar** — the titlebar's two buttons,
`FileFinder`, `SettingsDialog`, `DeleteEntryDialog` and the context menu's "Coming soon" keep it.
The migration stops at the sidebar because a mixed overlay vocabulary is only jarring *within* one
region; anyone "finishing the job" should do it as its own piece of work, not incidentally.

**The eight chord-bearing chrome controls are partitioned, not sequenced.** The concurrent *keymap reference* work introduces `chordTitle`, which makes a `label (chord)` native `title` keymap-derived. The sidebar's six chord-bearing controls do not use it — they render the label plus a real `Kbd` inside a `Tooltip`, which is the capability drawing it buys — while the titlebar's two keep `chordTitle`. Both honor invariant 31, which fixes the chord's *source* as the resolved keymap and says nothing about its rendering.

**"Tooltip" names the drawn primitive only.** A native one is a `title`. Invariant 31 and the *chord hint* row were amended accordingly, so the word does not denote both an OS attribute and a React component in the same file.

**The tooltip is not a modal layer**, though every other overlay in the app is. Invariant 25 has
an active modal layer absorb every keydown, matched or not, so registering one would make `j`/`k`
and `a`/`A` inert while the pointer merely rests on a row. It therefore forgoes Escape-to-dismiss
and instead hides on pointerleave, capture-phase scroll, window blur, any mousedown, and whenever
a real modal overlay is pushed.

**It stays store-free.** Content is a `ReactNode`, so an icon-button's live chord hint is resolved
from `useKeymapStore` at the `Sidebar` call site. `Modal` remains the only primitive with a side
effect, and the primitive/store boundary in the glossary holds.

> Raised by: `/grill`, 2026-09-06. See
> `.agents/specs/2026-09-06-sidebar-tooltip-primitive.md`.
