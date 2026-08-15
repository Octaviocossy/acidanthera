# Rule: Cross-Agent Skill Creation (Claude Code + OpenCode)

A **skill** is a procedure the agent reaches for on its own, loaded when the situation matches
its `description`. Keep one canonical `SKILL.md` in `.agents/skills/` and surface it to Claude
Code with a symlink — the same "canonical body in `.agents/`" bridge used for rules and
commands, adapted to how each agent discovers skills.

## Layout

```
.agents/skills/<name>/SKILL.md     # canonical body (source of truth)
.claude/skills/<name>              # relative symlink -> ../../.agents/skills/<name>
```

There is no `.opencode/skills/` entry: OpenCode reads `.agents/skills/` natively.

## Why a symlink rather than a wrapper

Commands need a wrapper per agent because neither agent reads the other's command directory.
That premise does not hold for skills:

| | Reads `.agents/skills/` | Reads `.claude/skills/` |
|---|---|---|
| **Claude Code** | no | **yes** — project skills; follows symlinks and loads the target once |
| **OpenCode** | **yes** — native | yes — Claude-compatible path |

So one real file serves both agents, and drift becomes impossible rather than merely detectable.
The reasoning and the rejected alternatives are in
`.agents/adr/0001-skills-canonical-in-agents-skills.md`.

The symlink must be **relative** (`../../.agents/skills/<name>`), never absolute — it has to
resolve in any clone and in a project set up by `/install-scaffold`.

## Frontmatter

Restrict frontmatter to the [Agent Skills](https://agentskills.io) spec fields so the skill
loads unchanged wherever it is used:

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | **Must equal the directory name** — OpenCode rejects a mismatch. Lowercase alphanumeric with single hyphens, 1–64 chars. |
| `description` | yes | What it does *and when to use it* — this is the only text the agent matches against when deciding to load the skill. Lead with the trigger. |
| `license`, `compatibility`, `metadata` | no | Accepted by both agents; neither acts on them. |

Claude Code accepts further fields (`allowed-tools`, `disable-model-invocation`,
`argument-hint`, `model`, `context`). They work, but they are extensions — other publishing
paths reject unknown keys outright. Use one only when the skill genuinely needs it, and expect
it to be inert in OpenCode.

## Skill or command?

| | Trigger | Lives in |
|---|---|---|
| **Command** | The user decides to start it — `/name` | `.agents/commands/` + two wrappers |
| **Skill** | The situation matches; the agent loads it unprompted | `.agents/skills/` + one symlink |

Prefer a skill for a procedure the agent should reach for without being told ("there is a merge
conflict in progress"). Prefer a command for work the user chooses to begin ("break this spec
into an epic"). In Claude Code a project skill *also* creates `/<name>`, so a skill is the
superset — but do not use one to dodge `command-creation.md` when the thing is really a command.

A skill that must never auto-load — because it needs a human in the loop, as
`design-interrogation.md` requires of `/grill` — belongs in `.agents/commands/` with
`disable-model-invocation: true`, not here.

## How to add a skill

1. **Canonical body** — `.agents/skills/<name>/SKILL.md`. Supporting files (scripts, templates)
   go in the same directory.
2. **Symlink** — `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.
3. **Manifest** — `.agents/skills/` and `.claude/skills/` are already listed recursively in
   `.agents/scaffold.manifest`; nothing to add unless you introduce a new skills root.
4. **Announce it** — add an `- Available: <name> — …` line under `## Skills` in `AGENTS.md`, and
   a row in the README skill catalog.
5. **Verify** — `sh .agents/scripts/verify-scaffold.sh` checks that every
   `.agents/skills/*/SKILL.md` exists, declares a `description`, has a `name` matching its
   directory, and is symlinked into `.claude/skills/`.

## Vendoring a skill from elsewhere

Keep the upstream body **verbatim** and put local grounding in a trailing
`## In this repository` section. An upstream update then reads as a clean diff against the top of
the file instead of a rewrite.

A vendored body carries **no attribution footer**. Where the artifact diverges from upstream — a
rename, a replaced line, an omitted section — record the divergence in an **ADR**, together with
the upstream path and the pinned commit. That record is the only thing that makes a later upstream
update reconcilable: without it there is no way to tell what we changed on purpose from what
upstream changed. See `.agents/adr/0019-vendored-artifacts-carry-no-attribution.md`.

## Rules

- One canonical body per skill. Never a second copy — that is what the symlink prevents.
- The symlink is relative, and points at a directory, not at `SKILL.md`.
- `name` must match the directory name.
- Restart the agent after adding the first skill: a skills directory that did not exist at
  startup is not watched.
- When you add a skill, list it under `## Skills` in `AGENTS.md`.

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/skill-creation.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` › Skills section |
