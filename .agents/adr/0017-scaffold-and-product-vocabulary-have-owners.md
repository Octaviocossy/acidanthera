# Scaffold and product vocabulary live in files with different owners

`.agents/ubiquitous-language-scaffold.md` holds the vocabulary of the harness — the review gate,
epic orchestration, issue labels, the command triad — and is owned and updated by the scaffold.
`.agents/ubiquitous-language.md` holds the project's own domain vocabulary and is owned by the
project, which receives it as an empty template.

The split is not tidiness. `.agents/scaffold.manifest` ships the glossary into every target and
`install-scaffold.sh` never overwrites, so before this split an upstream correction to scaffold
vocabulary **could never reach a project once installed** — the two owners shared one file and
only one of them could ever write it. Separating by owner is the precondition for an update
channel to exist at all (see ADR-0019, which builds it).

A consequence worth stating: **all** invariants live in `-invariants.md`, including the
scaffold's own. Splitting them by owner too would, in a repository whose vocabulary is entirely
scaffold, ship the `@`-imported file empty and put every hard-violation source on demand.
