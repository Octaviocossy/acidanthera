# The interactive review+rework procedure lives in `/review-branch`'s spec, not in a rule

The interactive review gate has two entry points — `/review-branch` and `/execute-issue`
Phase 3 — which is the same shape that made `parallel-orchestration.md` a shared rule for
`/execute-epic` and `/supervise-epic`. We chose the command spec anyway: the canonical body is
`.agents/commands/review-branch.md`, and `/execute-issue` Phase 3 refers to it rather than
duplicating it, the way `/spec` composes `/spec-breakdown` and `/execute-epic`.

A rule earns its own file when it carries invariants that bind code neither command owns. Here
the invariants are already elsewhere — in `.agents/ubiquitous-language.md` › Review gate, and
in ADR-0025 — leaving a rule file with nothing but the procedure a command spec already holds.

## Consequences

`/execute-issue` gains a cross-command reference; a future third entry point is the signal to
promote the procedure to `.agents/rules/`, not a reason to duplicate it.
