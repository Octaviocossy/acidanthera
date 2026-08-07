# Plan: Sync the current agent harness into orbit-111

> Status: **completed**
> Created: 2026-08-07
> Updated: 2026-08-07

## Goal

Bring this project's `.agents/` governance harness up to the current state of the upstream
`agentic-scaffold` repository, without losing any of orbit-111's project-specific customization.

## Context

orbit-111's harness was a fork of the scaffold frozen around 2026-07-22. Since then the scaffold
gained the design-interrogation workflow (`/grill`, `.agents/specs/`, ADRs), the cross-agent skills
convention, `/handoff`, a manifest-driven `/custom-init`, and two verification scripts.

The copier (`.agents/scripts/init-scaffold.sh`) only *fills gaps* — it never overwrites — so it
installs what is missing but leaves diverged files stale. Meanwhile orbit-111 carries real project
content in files the scaffold has since reset to neutral templates. The work was therefore
three-shaped: **copy** what was missing, **overwrite** what was stale-and-generic, **merge** what
carried project content.

Two upstream defects were fixed at the source first (in `agentic-scaffold`, branch
`chore/harness-fixes`) so this project received correct files rather than inheriting the bugs:

1. ADR `0001-skills-canonical-in-agents-skills.md` was cited by `AGENTS.md` and
   `.agents/rules/skill-creation.md` but had never been written.
2. `verify-scaffold.sh` check #7 ("stack neutrality") fails in any real project, since a real
   project legitimately tracks `src/` and a `package.json`. It is now gated on
   `.agents/scaffold.manifest`, which is never copied into a scaffolded project.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `.agents/rules/{adr,design-interrogation,skill-creation}.md` | New governance rules |
| CREATE | `.agents/commands/{grill,handoff}.md` + both wrappers | New slash commands |
| CREATE | `.agents/scripts/{init-scaffold,verify-scaffold}.sh` | Copier + structural gate |
| CREATE | `.agents/docs/workflow.{en,es}.md` | Bilingual workflow guide |
| CREATE | `.agents/skills/resolving-merge-conflicts/SKILL.md` + `.claude/skills/` symlink | Merge-conflict skill (hard dependency of the new `/execute-epic` step 8) |
| CREATE | `.agents/specs/.gitkeep`, `.agents/adr/{.gitkeep,0001,0002}` | Spec + ADR homes |
| MODIFY | `CLAUDE.md` | +3 `@` rule includes |
| MODIFY | `.agents/commands/custom-init.md` (+ both wrappers) | 2591 → 55 lines: manifest-driven copier |
| MODIFY | `.agents/commands/{planning,spec-breakdown,execute-epic}.md` | Settled-spec handling; guided merge-conflict recovery |
| MODIFY | `.agents/scripts/run-parallel-issues.sh` | Drop hardcoded commit trailer |
| MODIFY | `.agents/rules/{issue-resolution,parallel-orchestration}.md` | Genericize a stale example branch name |
| MODIFY | `.agents/rules/domain-glossary.md` | + "Active mode" section; canonical paths preserved |
| MODIFY | `AGENTS.md` | + Design Interrogation, ADR bullet, Skills section, `grill`/`handoff` |

### Explicitly preserved — never overwritten

`.agents/rules/testing.md` (full Vitest + Cargo conventions; upstream's is a stub) ·
`.agents/ubiquitous-language.md` (183-line project glossary) · `.gitignore` (project superset) ·
`.agents/parallel.config` (tuned: OpenCode runner, concurrency 6, `ACCEPTANCE_CMD`) ·
`.agents/plans/**` · the three project skills and their symlinks · `README.md` ·
`.claude/settings.local.json` · the `AGENTS.md` Testing / Workspace / Commands blocks.

## Architecture Decisions

- **`AGENTS.md` diverges from upstream in exactly four blocks** — Testing runners, Workspace,
  Commands, and the three project skills. Everything else is byte-identical, so a future sync is a
  readable diff rather than an archaeology exercise. The same holds tree-wide: `diff -rq` between
  the two `.agents/` directories now reports only `testing.md`, `domain-glossary.md`,
  `ubiquitous-language.md`, `scaffold.manifest` (upstream-only), and the project skills.
- **`.agents/scaffold.manifest` is deliberately not installed here.** orbit-111 is not a scaffold
  source, and the manifest's absence is exactly what makes `verify-scaffold.sh` skip its
  stack-neutrality check.
- **ADRs 0001 and 0002 ship with the harness.** They record decisions this project inherits (the
  skills symlink layout; `/handoff`'s GitHub sandbox). This project's own first ADR starts at 0003.

## Validation Criteria

- [x] `sh .agents/scripts/verify-scaffold.sh` exits 0 — 13 command triads, wrapper-body parity,
      wrapper frontmatter, 4 scripts, 4 skills. Stack neutrality reports *skipped*.
- [x] `diff -rq` between the two `.agents/` trees shows only the intended divergence listed above.
- [x] `.claude/skills/resolving-merge-conflicts` resolves through its relative symlink.
- [x] `git status` touches only `.agents/`, `.claude/`, `.opencode/`, `AGENTS.md`, `CLAUDE.md` —
      no `src/`, `src-tauri/`, or build config.

## Open Questions

None.

## Known Limitations

- **`/custom-init` is inert inside this project.** `init-scaffold.sh` resolves its manifest from
  its own repo root, and this project has no manifest by design. This matches the command's own
  documented usage: always invoke it from a clone of the scaffold repo, passing the target
  directory as an argument.
- **`skill-creation.md` step 4** asks for a row in "the README skill catalog". This project's
  README is the stock Tauri template with no such catalog; `AGENTS.md` § Skills is the catalog here.
