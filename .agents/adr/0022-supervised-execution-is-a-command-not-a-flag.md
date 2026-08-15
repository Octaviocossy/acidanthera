# Supervised epic execution is a separate command, not a flag in `parallel.config`

The request that started this was a flag in `.agents/parallel.config` choosing between auto-merge
and a review gate. That file is gitignored and per-machine, so the flag would make one
`/execute-epic` invocation fire-and-forget on one machine and an hour-long interactive session on
another — the shape of the session, decided invisibly. Instead there are two commands:
`/execute-epic` never prompts, `/supervise-epic` always does. (Both gate on the agentic review —
see ADR-0023 — so what the command name selects is whether a *human* is required.) The mode is
legible at the call site, and `/supervise-epic` carries `disable-model-invocation: true` for the same reason
`/grill` does — it is worthless without a human answering, and a headless parallel-runner child
must never start one.

## Consequences

Two command triads (six files) instead of one, for two behaviors that share roughly 90% of their
procedure: resolve the epic, read the plan file, compute waves, compute the frontier, invoke the
runner, close children, open the epic PR. That shared trunk lives in
`.agents/rules/parallel-orchestration.md` — which both wrappers already include with `@` — so each
canonical spec carries only what is genuinely its own. It cannot live as a partial in
`.agents/commands/`: `verify-scaffold.sh` §2 demands a full triad and a matching
`# Command: <slug>` heading for every file in that directory.

`.agents/parallel.config` is left holding only knobs that do not change the shape of a session —
concurrency, timeouts, `MAX_REWORK_ROUNDS`, branch retention. Anything that decides whether a
human is required belongs in the command name.

> Raised by: `/grill` on supervised epic execution, 2026-08-12. See
> `.agents/specs/2026-08-12-supervised-epic-execution.md`.
