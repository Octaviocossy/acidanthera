# The syntax palette is encoding, not signal

Invariants 21 and 27 leave the app two colours that *mean* something — ember for "the AI acted here,
or this navigates into the vault", red for "this click destroys" — and the design system states the
pair as exactly two coloured fills. A six-slot syntax palette adds hues without adding a third
meaning: `--syntax-keyword` asserts nothing about agency or danger, it distinguishes one lexical
category from another inside a fenced block, the way `--diff-add-fg` and `--diff-del-fg` already
distinguish direction and have sat in `colors.css` outside the pair since before this change.

The rejected alternative was to colour code with the monochrome `--text-*` ladder, which keeps the
app to four hues at the cost of flattening exactly the distinctions a reader opens a code block to
see. Having chosen colour, the boundary is what keeps the choice narrow, and the boundary is
invariant 59: the palette appears only inside code content, in both views, and never in chrome.

## Consequences

Invariant 27's "exactly two colored fills" gains a pointer to invariant 59 so it does not read as
contradicted. The slots are chosen by what the parsers actually emit rather than by convention —
measured across the twelve curated stream modes, `typeName` fires in three and
`function(variableName)` in one, so the roster merges `number` with `atom` and `typeName` with
`definition(variableName)` instead of shipping two tokens that would colour almost nothing.
