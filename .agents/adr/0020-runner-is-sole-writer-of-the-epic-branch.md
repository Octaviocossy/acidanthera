# The runner stays the epic branch's sole writer, even behind a human review gate

`/supervise-epic` pauses before integrating a child, and the obvious implementation is to let the
orchestrating agent run `git merge` once you approve — it already holds `Bash(git:*)`. We do not.
The runner is re-invoked with `--integrate` and performs the merge itself, under the same
`.worktrees/.merge.lock` and `__epic__` worktree it already uses in the auto path
(`run-parallel-issues.sh:194–223`). Having the agent merge would put a second writer on the epic
branch with no share in that lock, racing the in-flight children of the same wave; and the lock is
`mkdir`-based inside the runner, so it cannot be honored from outside it.

## Considered options

- **Orchestrator merges after approval** — simplest, but breaks the single-writer invariant and
  introduces an unlockable race with concurrent children.
- **A pull request per child, `child → epic`** — real review UX and CI, but contradicts "one
  `epic → main` PR, no per-child PRs" and moves the decision off-session onto github.com.
- **`--per-wave`: gate after the merge** — already documented as an unbuilt opt-in. Rejected
  because undoing a bad child then means reverting on the epic branch rather than simply
  declining it.

## Consequences

The review gate is a *scheduling* change, not a topology change: how a child reaches the epic
branch is byte-for-byte identical in both execution paths, so the merge path stays one
implementation with one set of failure modes. The cost is an extra process invocation per wave —
the runner is started once to produce the children and again to integrate the approved ones.

> Raised by: `/grill` on supervised epic execution, 2026-08-12. See
> `.agents/specs/2026-08-12-supervised-epic-execution.md`.
