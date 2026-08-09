# A destructive color role, disjoint from the AI accent

Orbit had exactly one colored fill — the ember `--accent`, which ADR 0007 reserves for "the AI
acted here" — and four surfaces that deliberately converged on monochrome for failure states
(`ToastHost`, whose docblock says *"no color"*, `ToolChip`'s error state, the chat error item, the
settings syntax diagnostic). We are adding a second: `--danger` (`#d3453f` dark / `#c8372e` light),
permitted on exactly two surfaces — a `Button` `danger` variant and the `--danger-soft` icon tile
beside a destructive dialog's title — because a confirmation whose destroy button is visually
identical to its Cancel button is a confirmation in name only.

The line the two roles draw is between **agency** and **consequence**, not between good and bad
news: ember means the agent acted, red means this click destroys. A failed operation is neither,
so it stays monochrome — the four existing sites do not change.

## Considered Options

- **Stay monochrome.** This is what
  `.agents/specs/2026-08-09-sidebar-context-menu.md` decision 15 chose one day earlier, reasoning
  that `--danger` adds a third color semantic for a single already-gated item. Rejected on looking
  at the built result: the gate reads as informational, and the button that discards unrecoverable
  unsaved edits is styled `secondary`, the same as "Change…" in the settings dialog.
- **Reuse the ember (`variant="primary"`).** Requested during the interrogation, and the cheapest
  option — zero new tokens. Rejected because it costs the thing ADR 0007 was protecting: the user
  can no longer scan the window for ember to find where the agent touched, since the loudest ember
  in the app would then be a button for the most deliberately human action there is. Reversing it
  later means re-auditing every accent-bearing surface.
- **A bright standard red** (Radix red 9, `#e5484d`). Rejected as the brightest pixel in the
  interface; it would out-shout the ember rather than sit beside it.

## Consequences

The `--danger` surface list is closed, not a starting point. The *sidebar context menu*'s Delete
item is explicitly excluded — it opens a dialog rather than destroying anything, and coloring it
would dilute the token from "this destroys" to "this is about deleting". Invariant 27 records this;
the next request to paint something red is answered by that list, the same way ADR 0007 answers
requests for a green success state.
