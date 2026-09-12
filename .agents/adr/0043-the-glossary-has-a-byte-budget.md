# The glossary has a byte budget, enforced mechanically

A completed cleanup — `.agents/plans/2026-07-22-clean-domain-glossary.md` — restructured this file
*and* wrote anti-append rules into `domain-glossary.md` specifically to stop it growing back; it
grew roughly sixfold afterwards, to 194,800 B. Prose rules alone have therefore already been tried
here and failed, so the budget is now mechanical: **600 B per Notes cell**, **warn at 80 KB and
fail at 100 KB** on the vocabulary file, checked by `verify-scaffold.sh`, with the Standards axis
at the review gate catching what a byte count cannot. A canonical reference that deliberately
refuses content is surprising enough to record, and once rows start being deleted it is expensive
to reverse.

The ceiling targets the tail rather than the average: the median Notes cell measured 293 B and was
already correct, while the p90 was 1,303 B and the worst row 3,842 B. 600 B is where the tail
begins (p75 = 617), so ~104 rows are untouched and 41 are cut.

## Consequences

Retirement is the **valve the cap opens**, not a routine pruning ritual — a term leaves when
removing its row would not change what anyone writes. *Aliases to avoid* is explicitly not evidence
of live ambiguity: 143 of 145 rows carried one because the table template asks for one, and a test
that trusted that column fired on 2 rows out of 145. The practical effect is that hitting the hard
cap forces a real decision about what the glossary is for, instead of letting the file grow
monotonically between cleanups.
