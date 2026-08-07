# Skills live canonically in `.agents/skills/`, surfaced to Claude Code by a symlink

Slash commands need a wrapper per agent because neither Claude Code nor OpenCode reads the
other's command directory — but that premise does not hold for skills: OpenCode reads
`.agents/skills/` natively, and Claude Code follows a symlink under `.claude/skills/` and loads
the target once. So a skill keeps **one** canonical body at `.agents/skills/<name>/SKILL.md`, and
`.claude/skills/<name>` is a **relative** symlink into it (`../../.agents/skills/<name>`) rather
than a second copy.

## Considered Options

- **A wrapper per agent, mirroring `command-creation.md`.** Rejected: a wrapper is only worth its
  cost when the two agents genuinely cannot share a file. Here they can, and two copies of a
  skill body make drift possible where the symlink makes it impossible.
- **Canonical bodies in `.claude/skills/`, symlinked into `.agents/skills/`.** Rejected: it puts
  the source of truth inside one agent's directory, contradicting the rest of the scaffold, where
  everything agent-agnostic lives under `.agents/`.

## Consequences

The link must be relative, never absolute, so it resolves in any clone and in a project
bootstrapped by `/custom-init` — `.agents/scripts/init-scaffold.sh` copies it with `cp -P` and the
manifest reproduces the same tree on the other side. `.agents/scripts/verify-scaffold.sh` enforces
the invariant: every `.agents/skills/*/SKILL.md` must exist, declare a `description`, carry a
`name` matching its directory, and be symlinked into `.claude/skills/`.

> See `.agents/rules/skill-creation.md`.
