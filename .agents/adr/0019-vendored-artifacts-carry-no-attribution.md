# Vendored artifacts carry no attribution; ADRs record the divergence

Skills and commands vendored from elsewhere keep the upstream body verbatim but carry **no
attribution footer** — the body is procedure, and a credit line at the foot of it is not something
the agent executing the procedure needs. Provenance and every deliberate divergence from upstream
are recorded here instead, which is where `.agents/rules/adr.md` already puts decisions that
outlive the task.

## Consequences

Without a footer, an ADR is the *only* way to reconcile a future upstream update: it is what
distinguishes what we changed on purpose from what upstream changed. So a vendored artifact that
diverges must be recorded, with the upstream path and the pinned commit.

## Vendored artifacts and their divergences

**`.agents/skills/standards-and-spec-review/`** — from `mattpocock/skills`,
`skills/engineering/code-review/SKILL.md` @ `84fdeff`. Two divergences:

1. **Renamed.** Upstream calls it `code-review`. Claude Code ships a built-in skill of that exact
   name, and `.agents/rules/skill-creation.md` requires `name` to equal the directory name (checked
   by `verify-scaffold.sh` §8), so keeping the upstream name would collide head-on. The
   `description` was rewritten for the same reason — it is the only text an agent matches on, so it
   now leads with this repo's trigger and explicitly cedes correctness-bug hunting to the built-in.
2. **One line replaced.** Upstream's *"run `/setup-matt-pocock-skills` if
   `docs/agents/issue-tracker.md` is missing"* names a command and a file that do not exist here;
   left in place it invites the agent to run something broken. It now points at the GitHub MCP
   server and `.agents/rules/issue-resolution.md`.

**`.agents/commands/handoff.md`** — from `mattpocock/skills`,
`skills/in-progress/claude-handoff/SKILL.md` (upstream marks it *in-progress*, i.e. unstable).
Upstream ships it as a skill with `disable-model-invocation: true`; per `skill-creation.md` a
procedure that must never auto-load belongs in `.agents/commands/`, so it is a **command** here and
the `claude-` prefix is dropped for cross-agent parity. Upstream's instructions —
summary-becomes-prompt, mandatory `--name`, a suggested-skills section, reference-don't-duplicate,
redaction, `$ARGUMENTS` as the next session's focus — are preserved. The `## Launcher` table, the
argument-order invariants, the two guards, the sandboxed default, the confirmation step, and the
`/execute-epic` boundary are local.

**`.agents/skills/resolving-merge-conflicts/`** — from `mattpocock/skills`,
`skills/engineering/resolving-merge-conflicts`. No divergence: steps 1–5 are upstream verbatim and
everything local lives in `## In this repository`.
