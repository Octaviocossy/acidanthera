# Spec: Motion Polish — Tab Chips, Agent Panel, Sidebar Faces

> Status: **settled**
> Created: 2026-09-26
> Grilled: 2026-09-26 — 2 rounds, 6 decisions
> Suggested next: /create-issue (as a child of epic #176)

## Goal

Fix four motion glitches shipped on `epic/176-smooth-motion-and-resizable-panels` before its PR
(#184) merges into `main`, and remove the pattern that caused three of them so it cannot come back.

The user reported three glitches. A code read found one more, with a cause in each case:

- **A new tab's text looks wrong while it opens.** `EditorTabChip`
  (`src/components/editor/EditorTabs.tsx`) tweens its wrapper's width from 0 to `auto`. Its content
  has no fixed width and no `nowrap`, so the title `<span>` re-wraps onto several lines on every
  frame. The same happens on close.
- **The *agent panel* opens with no animation; it closes with one.** `AgentPanelFrame`
  (`src/components/layout/AgentPanel.tsx`) sets `initial={false}` on the presence child, which
  disables its enter. Decision 12 of `.agents/specs/2026-09-26-smooth-motion-and-resizable-panels.md`
  already prescribes a width tween on open. This is conformance with that spec, not a new decision.
- **Collapsing or expanding the sidebar has a "weird effect" on its contents.** `SidebarLayer`
  (`src/components/layout/Sidebar.tsx`) has the same `initial={false}`. The entering face (the
  explorer or the *sidebar rail*) pops in at full opacity while the leaving face fades out, so both
  faces are superimposed for the tween's length.
- **Found, not reported: the *agent dock* pops in when the agent panel closes.** `DockPresence`
  (`src/components/layout/HomeSurface.tsx`) carries the same `initial={false}`. Decision 22 of the
  motion spec asks for a crossfade with the panel.

The shared root cause is a hand-written `initial={false}` on an `AnimatePresence` **child**.
Skipping the first-paint animation is the parent's job (`<AnimatePresence initial={false}>`). On a
child, `initial={false}` disables every enter, not just the first.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | How do the explorer and the rail swap while the sidebar's width tweens? | **Sequenced.** The leaving face fades out over the first half of the tween, and the entering face fades in over the second half. Both are mounted from frame 0, and the entering face is live at once: not inert, taking keys (invariant 60) | No frame shows both faces at meaningful opacity. A simultaneous crossfade leaves both at ~50% mid-tween, with the rail's icons ghosting through the explorer. This supersedes the "crossfading" wording of motion-spec decision 12 for the sidebar's faces only; the width tween itself is unchanged |
| 2 | How does a new tab chip enter? | **Width and fade, as motion-spec decision 15 says, with the content frozen.** The chip's content stays on one line at its natural width and is clipped by the growing wrapper, a left-to-right reveal. The exit collapses the same way, so the neighbours still slide into the gap | The glitch comes from the re-wrap, not from the width tween. Fixed content in a clipping frame is the pattern the agent card and the explorer already use |
| 3 | Does the unreported agent-dock fade-in join this fix? | **Yes. All four child-level `initial={false}` instances are fixed**: the tab chip's content, the agent panel frame, the sidebar faces, and the dock | Motion-spec decision 22 already requires the dock's crossfade. It is the same bug with the same fix, and leaving one instance keeps the pattern alive |
| 4 | Where does the fix land? | **A new child issue of epic #176.** It runs through the runner and the review gate and is integrated into the epic branch before PR #184 merges | `main` never receives the broken motion, and the open PR picks the fix up. A direct commit on the epic branch is ruled out by S5 (the runner is its sole writer) |
| 5 | What happens when the sidebar is toggled again mid-tween? | **The returning face fades back at once** from its current opacity, with no sequencing wait, while the other face leaves at the same time. A brief overlap is accepted in this case only | A reversal must never feel late. Keeping the sequence would leave the sidebar half-empty for ~120ms after an early reversal |
| 6 | How is the pattern kept from coming back? | **Shared helpers plus a written rule.** The four presence children move onto helpers in `src/lib/motion/presence-props.ts`, as `collapsePresence` and `crossfadePresence` already are. The helpers always declare the hidden enter state. The rule (a presence child never sets `initial={false}`; first paint is the parent `AnimatePresence`'s concern) goes in the JSDoc of that module and of `useExitPhase`. Regression tests come as `.agents/rules/testing.md` requires | Nobody writes `initial` by hand for a presence child again. The helpers extend an existing module rather than inventing a new one |

## Explicitly Out of Scope

- **Animating a chip's width when its content changes after the enter**: a rename rewrites the
  title in place (invariant 29), and the dirty dot appears. The chip resizes instantly, as today.
- **Scrolling the tab strip to reveal a new chip** that lands past the visible end of an overflowing
  strip.
- **Any other surface of epic #176**: dialogs, popovers, toasts, tree rows, transcript items,
  scroll, the theme crossfade, the *resize handle*. None was reported and none carries the pattern.
- **Retuning the motion vocabulary.** Durations, curves and the panels' width tween stay as
  motion-spec decisions 12 and 13 set them. Decision 1 here changes only how the sidebar's two
  faces share that tween.
- **A glossary invariant, glossary term or ADR for the `initial={false}` rule.** It is a Motion
  idiom, recorded in JSDoc (decision 6), not product vocabulary. No real trade-off stands behind
  it.

## Glossary Changes

None.

## ADRs Raised

None.

## Residual Unknowns

- **Parents need `initial={false}` once children declare a hidden enter.** Neither
  `HomeSurface`'s `AnimatePresence` around the dock nor `AgentPanel`'s outer one sets it today.
  Once the children enter from hidden, the dock would fade in on every mount of the *home surface*,
  including app launch. That is the "animating the initial render" the motion spec rules out. The
  agent panel never starts open, because open state is not persisted, but its parent gets the same
  guard for symmetry. The plan confirms each parent.
- **The invisible entering face takes pointer input.** During the first half of an expand, the
  explorer is at opacity 0 but live (invariant 60), while the fading rail is inert. The rail's
  *Expand sidebar* button (x 8–32, y 76–100) sits under the explorer's first *primary nav* row
  (x 10–214, y 76–~104). That row is *New note*, or *Agent* without a vault. A double-click on
  expand has therefore always landed on that row, before this epic too, when the explorer replaced
  the rail in one frame. The sequenced fade only hides the row for the first ~120ms. Deferring
  the entering face's pointer input would be an animation delaying input, which invariant 60
  forbids. So this is accepted and recorded, not fixed.
- **Asserting an enter in tests.** Vitest runs with `MotionGlobalConfig.skipAnimations`, so an
  enter completes at once. How a regression test proves that the enter starts from the hidden
  state is the plan's choice. Two candidates: asserting the helper's `initial`, or the first
  commit's inline style.
- **Sequenced fades under Reduce Motion.** The width jumps (motion-spec decision 5), and the fades
  remain. The two halves then play out over an already-final width. This is recorded so the plan
  does not rediscover it, not reopened as a question.
- **Stale comments.** `SidebarLayer`'s JSDoc and the `Sidebar` doc comment describe the faces as
  "crossfading", and `AgentPanelFrame`'s describes a 0-to-width tween that never ran. Both change
  with the code.
