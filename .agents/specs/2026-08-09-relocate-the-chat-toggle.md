# Spec: Relocate the AI chat toggle into the titlebar

> Status: **settled**
> Created: 2026-08-09
> Grilled: 2026-08-09 — 4 rounds, 13 decisions
> Suggested next: /create-issue

## Goal

Move the AI chat toggle out of the floating `AiFab` and into the titlebar's control cluster,
immediately left of `⚙`, so the app's chat entry point is a normal chrome control rather than a
card floating over the panel it opens — and retire the 72px header reservation that only
existed to dodge it.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Where the chat toggle lives | Titlebar right cluster, immediately left of `⚙` | The titlebar is the global chrome host (ADR 0009 as amended by 0011), and its right edge is the same side as the 340px panel it opens. The sidebar rail lost because ADR 0011 defines it as a *vault launcher*, and chat is not vault navigation |
| 2 | Scope of the change | Relocation plus the cleanup it forces — nothing else | `ChatPanel`'s reserved band and `--rail-fab` lose their reason to exist and must go; the rest of the chat panel is a separate pass |
| 3 | What the control expresses | Pure toggle; no in-flight agent indicator | A turn running behind a closed chat is invisible today, but that is a chat-state problem, not a placement one |
| 4 | Size and grouping in the cluster | Identical 24×24 ghost button to the cog; cluster `gap-1` → `gap-2`; no divider | The ember glyph does the differentiating. A rule between two 24px buttons, or a physically larger AI button, adds back the chrome weight `d47dded` had just removed |
| 5 | Glyph form | Keep the raw `✦` character rather than drawing an SVG glyph | `✦` is a **filled** mark and the house drawn style is a 1.2px outline stroke, so drawing it would change it in kind, not just in weight. Optical match against `CogGlyph` becomes a validation step in the running app |
| 6 | Does the ember accent travel with it | Yes — `text-accent` stays | ADR 0007 names the FAB glyph a permitted carrier, and the control does not stop being the AI affordance by changing address. One ember pixel in a monochrome bar is exactly the scanning signal that ADR protects |
| 7 | What replaces the 72px chat header band | `h-[var(--rail-titlebar)]` (40px); delete `--rail-fab` | Joins the 40px chrome rhythm every other rail already uses. Aligning to `EditorTabs` was rejected: it has no height token and returns `null` at zero buffers, so the alignment would be unenforceable and conditional |
| 8 | How the open state reads | `aria-pressed` only — no visual open state | A 340px panel appearing beside the editor is the state. Same logic as `CommandBar`, whose *presence* is the `GlobalMode` indicator; ADR 0009 already accepted accessible names carrying what the pixels do not |
| 9 | Does `AiFab` survive as a component | No — delete it and inline the button in `Titlebar.tsx`, as the cog is | Six lines reading two store fields do not earn a file, `Titlebar.test.tsx` already covers the surface, and "FAB" is a lie once it neither floats nor is an action button |
| 10 | Is the chrome-accent boundary an ADR | No — spec decision row plus glossary | Fails `adr.md`'s hard-to-reverse test: `text-accent` → `text-text-secondary` is a one-word diff. This *applies* ADR 0007 rather than deciding something new |
| 11 | The adjacent `global.toggle-chat` routing cleanup | Declined | The button calls `toggleChat` directly before and after; the keymap layer is untouched by this change |
| 12 | Chat header layout at 40px | Tabs left, `New chat` pushed right with `ml-auto` | The left-alignment's only stated justification (`ChatPanel.tsx:91-93`) is the FAB, which is being deleted; leaving it would preserve a workaround for a problem that no longer exists |
| 13 | Advertising `Ctrl-w c` in the empty editor state | No change | The zero-buffer state is deliberately spare — wordmark, one line, path, one chord. A second chord turns a single suggestion into a menu |

## Explicitly Out of Scope

- **In-flight agent invisibility.** Closing the chat unmounts `ChatPanel` while the turn keeps
  running in `useChatStore`, with no indication anywhere. A real gap, and this change removes
  the last surface that could have shown it — but it is a chat-state decision, not a placement
  one. Deliberately deferred to its own interrogation.
- **Routing `global.toggle-chat` through `executeAppCommand`.** It is wired directly to the
  store in `use-global-keymap.ts` and `region-exit.ts`, which is why glossary invariant 3 is
  only half-true. Seen and declined, not missed.
- **A close control on the chat panel itself.** Unnecessary once the toggle sits directly above
  the panel — closer than the FAB was, not further.
- **`Ctrl-w c` in the empty editor state** (decision 13).
- **Hover feedback on titlebar buttons.** `Button`'s `ghost` variant defines none, so neither
  the cog nor the new control gets one. Pre-existing; not this change's job.
- **A drawn `SparkGlyph`** (decision 5), and **any second accent carrier in chrome** — decision
  6's trade only pays while `✦` is the sole ember pixel on that surface.

## Glossary Changes

Written inline during the session (`.agents/ubiquitous-language.md`, Last updated 2026-08-09):

- **Chat toggle** — new term, replacing the retired `AiFab`. The titlebar control that toggles
  `chatOpen`; state carried by `aria-pressed`, with the panel's presence as the visible
  indicator.
- **Titlebar** — rewritten. It carried "the window title and `⚙` settings, nothing else"; it
  now carries the title, the chat toggle, and settings, and is the first chrome surface to
  render the ember accent.
- **AI accent** — extended with the chrome boundary: *chrome is monochrome unless the control
  **is** the AI surface*, stated against ADR 0011 decision 16, which refused the accent to the
  orbit mark on the rail.
- **Editor status cluster** — unaffected, but note the viewer's top-right is now free; ADR
  0009's reflex warning applies.

## ADRs Raised

None. The candidate rule — *ember may enter a chrome surface when the control is the AI
surface* — failed `adr.md`'s hard-to-reverse test (decision 10) and is recorded in the glossary
instead.

## Residual Unknowns

Two items settled in principle but requiring confirmation in the running app, both recorded as
validation steps rather than open questions:

1. **Optical match.** `✦` at `text-ui` beside the 15px drawn `CogGlyph`. Decision 5 accepted
   that the character's final size is tuned by eye, not derived.
2. **Window dragging.** Two buttons plus an 8px gap inside the `relative` cluster must leave the
   `deep` drag region working from both the bar and the gap, with both buttons still clickable.
   The glossary already flags this as verifiable only in the app, never in a unit test.
