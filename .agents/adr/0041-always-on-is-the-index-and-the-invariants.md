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
