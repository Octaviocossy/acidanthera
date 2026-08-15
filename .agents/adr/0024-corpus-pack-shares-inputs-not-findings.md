# The corpus pack shares review inputs, never findings

The agentic review used to load the standards corpus (~22k tokens today) into two isolated
contexts per child — the per-child reviewer plus its Standards sub-agent — on every `--review`
invocation, because axis isolation was read as forbidding any sharing between passes. We decided
the isolation the two-axis design protects is blindness between *findings*, not exclusivity over
*sources*: the runner concatenates the standards sources verbatim into a per-invocation **corpus
pack** (`.worktrees/.corpus-pack.md`) that every child's Standards sub-agent reads, while the
orchestrating reviewer passes paths without reading contents. It is a `cat` per `--review`
invocation — deliberately not a durable cache (nothing to invalidate, the same reasoning as
ADR-0021) and not a lossy digest (hard violations hinge on the exact wording of the glossary and
the ADRs).
