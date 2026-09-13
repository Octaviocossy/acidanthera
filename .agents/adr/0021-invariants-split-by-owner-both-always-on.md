# Invariants are split by owner too, and both files are always-on

ADR-0017 split the vocabulary by owner but kept every invariant, a project's product ones
included, in the one scaffold-owned `.agents/ubiquitous-language-invariants.md`, reasoning that a
split would ship the single `@`-imported file empty in a repository whose invariants are all
scaffold. In a real consumer that put product invariants in a file the scaffold rewrites: on
2026-09-13 a sync into acidanthera delivered over 38 of them with exit 0. We now split the
invariants the way the vocabulary is split — `-invariants.md` is project-owned and seeded as a
template, `.agents/ubiquitous-language-invariants-scaffold.md` is scaffold-owned and carries the
harness's — and `@`-import **both**, which is what dissolves 0017's objection: the always-on set
is two files, and neither is ever on demand. This supersedes the last paragraph of ADR-0017; the
vocabulary split it records stands.

## Consequences

- Scaffold invariants carry permanent identifiers `S1`, `S2`, … (invariant `S21`: assigned once,
  never renumbered, never reused), because a consumer can no longer number them in a file it does
  not own and still needs to cite one across a sync.
- A consumer's `CLAUDE.md` is project-owned, so the second import reaches it only by hand;
  `verify-scaffold.sh` §14 fails the consumer's gate until it is there — the silent failure
  ADR-0016 warns about, made loud.
