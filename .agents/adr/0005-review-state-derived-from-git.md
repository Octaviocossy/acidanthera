# Review state is derived from git, never stored

`/supervise-epic` needs two pieces of state: which children are waiting for review, and how many
rework rounds a child has already consumed. Both are read out of git rather than kept in a file. A
child awaits review if its remote branch exists and the epic branch carries no `Merge child #N`
commit for it; its rework count is the number of `rework(#N): ronda K` commits on that branch. The
runner truncates `.pushed`, `.failed`, `.merged` and `.mergefail` on every start
(`run-parallel-issues.sh:232–235`), so those files cannot carry anything across invocations — and
`/execute-epic` already defines "done" by scanning the epic branch's commit messages, so this is
that same mechanism extended rather than a new one.

## Consequences

Quitting mid-review costs nothing: re-running resumes exactly where it stopped, `.worktrees/` can
be deleted at any time, and the two execution paths can be alternated on the same epic wave by
wave without bookkeeping.

The deliberate cost is that a **rejection is not remembered**. A child you rejected and chose not
to rework looks identical to one never reviewed, so it is presented again on the next run. The
alternative — a durable state file — buys that memory at the price of a second source of truth
that can disagree with git, which is the failure mode this decision exists to avoid.

> Raised by: `/grill` on supervised epic execution, 2026-08-12. See
> `.agents/specs/2026-08-12-supervised-epic-execution.md`.
