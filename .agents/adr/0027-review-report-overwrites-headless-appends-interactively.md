# `<branch>.review.md` overwrites under the runner and appends interactively

Both paths write their review report to the same filename, with deliberately different
lifecycles: the runner overwrites it on every `--review`, while the interactive gate appends a
`## Round N` section per rework round.

The asymmetry follows where the history already lives. Under the runner each rework round
leaves a `rework(#N): ronda K` commit and a full `<branch>.log`, so an overwritten report loses
nothing recoverable. The interactive path never commits (ADR-0025), so the report file is the
only place a prior round survives at all — overwriting it would erase what the code looked like
before the rework, which is exactly what a human weighing the next round needs to see.

## Consequences

A reader of an interactive report must take the **last** `## Round N` section as current. The
file stays an artifact and never becomes state: nothing reads it back to decide what stage a
change is at, so ADR-0021 is untouched.
