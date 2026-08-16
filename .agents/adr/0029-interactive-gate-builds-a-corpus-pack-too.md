# The interactive gate builds a corpus pack too

`/review-branch` builds a corpus pack before dispatching its reviewer, using the same
`.agents/scripts/build-corpus-pack.sh` the parallel runner calls under `--review`.

The interactive gate was originally specified *without* a pack: one review per invocation does
not amortize the build the way fanning out over a wave of children does. That reasoning assumed
the reviewer was an in-session sub-agent, for which reading two dozen files is cheap. Once the
reviewer became an external process under `REVIEW_AGENT_EXEC_CMD` (ADR-0028), it stopped being
cheap — the reviewer must pull `AGENTS.md`, every rule, the glossary and every ADR through its
own tool calls, and the observed failure mode is not that it costs more but that it reads *less*
and reports shallowly. The pack is what makes the standards sources arrive whole.

## Consequences

The pack builder moved out of `run-parallel-issues.sh` into its own script so both paths share
one source list; the runner's `build_corpus_pack()` now delegates to it. The skill's rule is
unchanged and still binding: the pack goes to the **Standards** sub-agent only, never to the Spec
one, whose sources are per-change. Axis isolation is blindness between findings, never
exclusivity over sources (ADR-0024).
