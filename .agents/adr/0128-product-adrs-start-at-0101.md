# Product ADRs are numbered from 0101; the scaffold owns 0001–0100

The cross-agent scaffold (`.agents/scaffold.manifest`, synced by `/install-scaffold`) ships its own
ADRs at fixed numbers — 0001–0020 today, growing with every upstream decision — and delivers them by
path, so a project whose ADRs occupy the same numbers collides on every sync. This project's first
install dodged that by renumbering the scaffold's ADRs +16, which put the same decision under two
numbers here and upstream and turned every later sync into a by-hand job. The scaffold's numbers are
now the scaffold's: **0001–0100 are reserved** for ADRs the sync delivers, and this project's own
decisions start at **0101**, in their original order (the old 0003–0018, 0032–0040 and 0042 became
0101–0127). `.agents/rules/adr.md`'s "highest number plus one" still holds within the product range.

## Consequences

Every reference is a pointer, so all of them were rewritten — code comments, specs, plans and the
glossary changelog included. The changelog rows that *describe* the old +16 renumbering keep their
old numbers: they are about the numbering itself, and rewriting them would falsify the record. A
future scaffold ADR lands in the reserved range with no rename here; a project decision never takes a
number below 0101.
