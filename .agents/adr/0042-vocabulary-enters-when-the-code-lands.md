# Vocabulary enters the glossary when the code lands, not when the design settles

`.agents/rules/domain-glossary.md` required a resolved term to be written into the glossary
*inline, during the interrogation*, which directly contradicts the glossary's own first maintenance
rule — *describe current behavior*. The `settled ahead of implementation` marker existed to paper
over that contradiction, and both markers in the file were stale for epics that had already landed.
A term is now written into the design spec's `## Glossary Changes` section during `/grill` and
promoted into the glossary when the implementation merges; the marker convention is deleted.

This reverses the rule's *"Write inline, never batched"* section, so it is recorded here — without
it, the next reader restores the old behavior as an obvious fix. The sharpening that writing a
definition mid-session produces is not lost: it still happens, into the spec. What is lost is a
whole class of growth — vocabulary written for a design that changed shape during implementation,
which previously landed in the glossary anyway and was never removed.
