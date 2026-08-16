# Every agentic review dispatches one reviewer process per axis

Both review paths dispatch their reviewer as **one external process per axis**, through the one
shared dispatcher `.agents/scripts/run-review-agent.sh`: the interactive gate (`/review-branch`,
`/execute-issue` Phase 3) calls it once per axis from the repository root, and the parallel
runner's `--review` action calls it once per axis per child from inside the child's worktree,
composing the two axis reports into `.worktrees/<branch>.review.md` itself. Each axis gets its
own wall-clock cap (`REVIEW_TIMEOUT`, per attempt), its own pre-materialized sources, and its own
visible outcome — one axis timing out no longer takes the other's report down with it, and the
gate can say *which* axis failed.

The alternative was one reviewer process that forks the two axes internally — the original
runner design, and the shape the first interactive gate copied. It spent a whole context
orchestrating (reading nothing, forwarding paths), hid which axis was stuck behind a single
process's stdout (observed: a Standards axis finishing while the Spec axis ran unbounded), and
silently required the reviewer CLI to support sub-agent fan-out — an undocumented adapter
requirement that a per-axis dispatch removes entirely. Flattening also strengthens axis
isolation rather than weakening it: two operating-system processes cannot see each other's
findings at all, which is the property `.agents/ubiquitous-language.md` demands. In-session
sub-agent fan-out survives only as the interactive fallback when no external reviewer is
configured, and when the skill is invoked directly in a session.

## Consequences

`.agents/skills/standards-and-spec-review/SKILL.md` carries a *single-axis invocation*
grounding: a process told which axis it is runs that axis alone, dispatches nothing, and returns
that axis's report as its entire final message. Aggregation and the gate line belong to whoever
dispatched it — the session interactively, the runner headless.

`PARALLEL_MAX_CONCURRENCY` still counts children, so `--review` may run up to twice that many
reviewer processes at once — two lighter contexts per child instead of three (orchestrator plus
two sub-agents).

**Concurrent dispatch can collide on the reviewer CLI's per-user state, so the cap is not a
single launch.** Two `opencode run` processes started at the same instant fail within a second
with `database is locked`: its session store is one global
`~/.local/share/opencode/opencode.db`, shared regardless of which directory each process runs
in. The contention is at **startup only**, measured rather than assumed: the same two dispatches
offset by twelve seconds both completed. The dispatcher therefore retries **once** (the
`REVIEW_RETRIES` default; env-only, `0` disables) on a failure that is fast, non-zero *and*
silent on stdout — the signature of that collision, not of a review that failed on its merits. CLIs without shared mutable state (codex under `--ephemeral`) never
trip it; the retry stays as CLI-agnostic robustness.

The retry is why `REVIEW_TIMEOUT` bounds an **attempt**, not an axis. The axis's worst case is
`REVIEW_RETRY_WINDOW + REVIEW_RETRY_DELAY + REVIEW_TIMEOUT + REVIEW_KILL_GRACE` — **955s** at the
defaults, since an attempt that runs past the retry window can no longer be retried, a timed-out
attempt never is (spending a second full clock is exactly what a cap exists to prevent), and the
last attempt may need the full SIGTERM-to-SIGKILL grace to actually die.
