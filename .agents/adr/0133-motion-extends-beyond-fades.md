# Motion extends beyond fades

The design system allowed one kind of motion, "150ms fades only, never bounce", and the
collapsible-rail spec (decision 22) kept the sidebar's collapse instantaneous because animating a
width reflows CodeMirror on every frame. The app read as clunky for it: the agent panel landed 340px
wide in a single frame, every overlay vanished the moment it closed, and the viewer jumped whenever
a panel came or went. Motion is now **mechanical, widened** — fades, short 4px translates and real
width transitions, on three durations (120/180/240ms), entering on a decelerating curve and leaving
on an accelerating, shorter one. There is still no bounce, spring or stagger.

The cost accepted is exactly the one decision 22 refused: while a panel tweens its width, the viewer
re-wraps its text for 240ms. Both ways around it — sliding the panel over the viewer and resizing the
viewer once at the end, or resizing it first and sliding the panel into the gap — keep one jump,
which is the thing this decision exists to remove.

## Considered Options

- **Fades everywhere** kept the old rule, and could not touch the worst offender, a panel's width.
- **Expressive motion** — springs, overshoot, staggered entrances — was rejected as the wrong voice
  for a keyboard-first editor.

## Consequences

**Keyboard hot paths do not animate**: switching tabs, the view toggle, a keyboard cursor, `Ctrl-w`
region moves, opening a buffer, and a `j`/`k` line scroll. They run dozens of times a minute and any
motion there reads as latency, so this carve-out is what stops the wider vocabulary from making the
app feel slower. Adding a transition to one of them undoes a decision rather than polishing an
oversight. Pointer hover still transitions; a keyboard cursor over the same row does not.

Invariant 60 is the companion rule: motion never delays input, so an element leaving is inert from
its first frame of exit. macOS Reduce Motion is honoured by dropping movement, width and scroll
animation and keeping the fades.

This supersedes the "Use 150ms fades only" line of `.agents/skills/acidanthera-design/SKILL.md` (a
divergence ADR 0129 records) and decision 22 of `.agents/specs/2026-08-08-collapsible-sidebar-rail.md`.
The same session also reversed the "Resizable panes" exclusion of
`.agents/specs/2026-08-08-orbit-design-system.md`: the expanded sidebar and the agent panel now
resize under the mouse, and that resize is the one width change that follows the pointer instead of
animating.

> Raised by: `/grill`, 2026-09-26. See
> `.agents/specs/2026-09-26-smooth-motion-and-resizable-panels.md` (decisions 1, 3, 12, 13).
