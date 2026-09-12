# Always-on context is the index and the invariants, never the glossary body

`.agents/ubiquitous-language.md` had grown to 194,800 B — 72% of every byte `CLAUDE.md`
`@`-imports into each session, roughly 50k tokens — and a glossary that large is not actually
obeyed, so its authority was nominal rather than real. What is permanently in context is now a
generated ~4 KB **glossary index** (term → area, one line each, no definitions) plus the
**invariants**, extracted to their own file; the vocabulary body is read on demand when
`.agents/rules/domain-glossary.md`'s MUST-read rule fires. The invariants stay always-on because
`standards-and-spec-review` makes a breach of them a *hard violation* and they constrain all code,
not just code that touches a given term — leaving them in the on-demand body would make the most
enforcement-critical content in the repo the least-loaded.

## Which invariants

The invariants are **one numbering space split across two files**, and only 1–38 are imported:

| Invariants | File | `@`-imported | Constrains |
|-----------|------|--------------|-----------|
| 1–38 | `.agents/ubiquitous-language-invariants.md` | **yes** | product code — `src/`, `src-tauri/src/` |
| 39–56 | `.agents/ubiquitous-language-scaffold.md` | no | the governance harness — `.agents/`, `.claude/`, `.opencode/` |

The split is not a byte-budget concession dressed up as a principle; it follows the same test the
rest of this ADR applies. What earns always-on status is content that constrains code the agent
might write *without knowing it is in scope*. Invariants 1–38 do: any edit under `src/` can breach
one, and an agent has no way to know which until it already holds them. Scaffold invariants 39–56
cannot be breached that way — breaching one requires editing the scaffold itself, and every context
that does so is already holding the scaffold file. A reviewer gets it in the **corpus pack**
(ADR 0024), which is lossless by construction; an agent editing `.agents/` reaches it through the
index, whose pointer is always on. So the enforcement-critical reasoning above — "the most
enforcement-critical content in the repo would be the least-loaded" — does not apply to 39–56: they
are never less loaded than the work that can violate them.

Importing the scaffold file would add 18,412 B to **every** session, the large majority of which
never touch `.agents/`. That is the recall problem this ADR exists to fix, reintroduced at a quarter
scale.

This is stated here because `.agents/rules/domain-glossary.md` marks the scaffold file "no" in its
five-file table, and a bare "no" reads as an oversight against this ADR's own summary sentence.

## Considered Options

- **Drop the `@` import entirely**, relying on the two existing MUST-read instructions, whose
  canonical domain paths (`src/`, `src-tauri/src/`) cover nearly every file. Rejected because its
  failure mode is silent: an agent that never classifies its work as domain code simply never reads
  the glossary, and nobody finds out. The index keeps the trigger visible.
- **Keep the whole file imported.** Rejected: even after relocation and compression that is still
  ~15–25k tokens of always-on context, which is the recall problem itself.

## Consequences

The index is **checked in**, because `@` imports a path and cannot run a script. It is therefore
generated *and* verified by `verify-scaffold.sh` rather than trusted — the corpus pack's
anti-staleness discipline (ADR 0024) adapted to a file that has to persist on disk.
