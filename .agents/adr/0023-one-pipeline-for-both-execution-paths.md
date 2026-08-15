# Both epic execution paths share one pipeline; the inline merge was given up for it

`/execute-epic` used to merge each child into the epic branch inline, inside the child's own job,
the moment its push succeeded (`run-parallel-issues.sh:194–223`) — so child #1 integrated while
child #2 was still being written. Once a review had to run *before* integration, that stopped
working: a review cannot run on something already merged. Both paths now run the same stages —
plain run to push the wave, `--review`, optional `--rework`, then `--integrate` — and the only
difference between `/execute-epic` and `/supervise-epic` is whether a human resolves the findings
or the hard-violation rule does.

## Consequences

An epic takes longer in wall-clock than it did: the wave must finish before anything integrates,
where merges used to overlap with still-running siblings. That is the price, and it is paid on the
auto path too, which never asked for a review gate in the first place.

What it buys is one integration path instead of two. The merge lock, the `__epic__` worktree, the
branch deletion and the conflict handling exist once, so a bug there is one bug — and the review
gate cannot be quietly bypassed by whichever path skipped it.

The tempting future "optimization" is to restore the inline merge for the auto path, since nobody
is waiting on a prompt there. It would reintroduce the second integration path and silently drop
the agentic review, because there is no point in the pipeline where it could still run.

> Raised by: `/grill` on epic execution behind a review gate, 2026-08-12. See
> `.agents/specs/2026-08-12-supervised-epic-execution.md`.
