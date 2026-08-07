# Agentic Workflow Guide

> Language: **English** — [Español](./workflow.es.md)

This guide walks through how to actually *use* the scaffold day to day, once it is
installed in a project. For install instructions and a file-by-file layout, see the
root `README.md`. For the exact behavioral contract of any single piece, the
canonical source is always the file this guide links to — this document explains
how the pieces fit together, not the last word on any one of them.

## Philosophy

One set of rules, consumed identically by two agents. `AGENTS.md` is the canonical
entry point (OpenCode reads it directly); `CLAUDE.md` inlines the same rule files via
`@path` includes so Claude Code never drifts from what OpenCode sees. Everything
under `.agents/` — rules, commands, plans, scripts — is agent-agnostic; nothing in
this scaffold is Claude-only or OpenCode-only.

The toolchain is zero-dependency by design: POSIX `sh` + Markdown. There is nothing
to `npm install` before the workflow itself works.

## Core loop: grill → plan → implement → verify → ship

The scaffold's day-to-day shape, whether or not GitHub issues are involved:

1. **Grill.** When the design isn't settled yet, run `/grill "<topic>"` before planning
   anything. It models the work as a design tree and asks the whole **frontier** — every
   decision whose prerequisites are already settled — as one numbered round, each question
   carrying its recommended answer, then stops and waits for you. Facts are the agent's job
   (it dispatches sub-agents rather than asking you what it could look up); the decisions are
   yours. While it questions, it sharpens `.agents/ubiquitous-language.md` inline and offers
   an ADR for any decision that is hard to reverse *and* surprising *and* a real trade-off.
   When the frontier is empty it writes a settled spec to
   `.agents/specs/[yyyy-mm-dd]-[short-kebab-description].md` and tells you what to run next:
   `/planning` for local work, `/create-issue` for a single issue, or
   `/spec-breakdown <spec path>` for something big enough to split. Full protocol in
   `.agents/rules/design-interrogation.md`. Skip this step when the design is already obvious.
2. **Plan.** For anything non-trivial, produce a plan file before writing code.
   Either ask the agent to plan (entering plan mode triggers this automatically) or
   run `/planning "<description>"`. The plan is saved to
   `.agents/plans/[yyyy-mm-dd]-[short-kebab-description].md` following the structure
   in `.agents/rules/plan-creation.md` — Goal, Context, Affected Files, a numbered
   Step-by-Step Implementation detailed enough for a less capable model to execute
   without guessing, Architecture Decisions, Validation Criteria, Open Questions.
   Status starts at `draft`.
3. **Review.** The plan is presented before any implementation starts. Approve it,
   or send it back for changes — status moves to `approved` once you do.
4. **Implement.** The agent works the plan's Step-by-Step Implementation in order,
   marking status `in-progress`, then `completed` once every Validation Criteria
   item passes. Any domain code touched along the way must first be checked against
   `.agents/ubiquitous-language.md` (see below).
5. **Verify.** Run whatever your project's `## Commands` in `AGENTS.md` define for
   lint/build/test. If you're modifying the scaffold itself rather than an adopting
   project, `sh .agents/scripts/verify-scaffold.sh` is the acceptance gate — see
   below.
6. **Ship.** Commit, and if the work is tracked as a GitHub issue, run `/ship-note`
   to post what actually happened as a comment (see the GitHub issue workflow
   below). `/ship-note` never closes the issue — that's a deliberate human checkpoint.

## Keeping domain vocabulary honest

`.agents/ubiquitous-language.md` is the single source of truth for canonical entity
names, types, states, and invariants. `.agents/rules/domain-glossary.md` is the
enforcement rule: before touching any file that lives in a canonical domain path, or
that names/exports/imports/changes a glossary concept, read the glossary first. If
you introduce or change canonical vocabulary, add it to the glossary, bump
`Last updated` to the current ISO date, and add a Changelog row — never silently
rename a concept in code without updating its definition.

That rule has two modes. The **passive** one above applies whenever you touch domain
code. The **active** one runs during a `/grill` session: terms that conflict with the
glossary get challenged on the spot, fuzzy words get sharpened into canonical ones,
relationships get stress-tested with invented edge cases, and claims about how something
works get cross-checked against the actual code. Resolved terms are written back
immediately rather than batched up at the end. Decisions that outlive the task itself
go to an ADR in `.agents/adr/` instead — see `.agents/rules/adr.md` for the three-part
test that keeps that directory from filling up with routine choices.

## Testing

`.agents/rules/testing.md` defines what to test (pure logic first, then stateful
modules, then interactive/UI units, then boundary code) and how (assert observable
behavior, mock only real I/O boundaries, deterministic fixtures, one
assertion-worthy behavior per test) independent of any stack. Once your project
adopts a runner, fill in the runner-specific placeholders in that file and in
`AGENTS.md` › `## Testing` / `## Commands` › `Test:` — keep the two in agreement
rather than letting them silently diverge.

## Slash commands

Every command is defined once as an agent-neutral spec in
`.agents/commands/<name>.md`, with a thin per-agent wrapper in `.claude/commands/`
and `.opencode/commands/` that only differs in frontmatter (`.agents/rules/command-creation.md`).
Invoke identically as `/<name>` in either agent.

| Command | Use it for |
|---|---|
| `/grill` | Settling a design by interrogation before any artifact is written. |
| `/planning` | Producing a reviewable implementation plan before writing code. |
| `/commit-message` | Generating a Conventional-Commits message from the current diff. |
| `/custom-init` | Bootstrapping this scaffold into a target project (see below). |
| `/create-issue` | Turning a requirement description into a GitHub issue with a full plan in its body. |
| `/update-issue` | Correcting an issue's body/title when the first generation was off. |
| `/execute-issue` | Executing the current branch's linked issue, two phases: confirm, then implement. |
| `/comment-issue` | Adding a comment to the current branch's issue thread without touching state. |
| `/ship-note` | Posting a comment describing what actually shipped, once work is done. |
| `/spec-breakdown` | Decomposing a large spec into an epic issue + dependency-graphed child issues. |
| `/execute-epic` | Running an epic's children wave-by-wave in parallel worktrees, then opening one PR. |
| `/spec` | One-shot: `/spec-breakdown` then `/execute-epic`, chained. |
| `/handoff` | Passing this conversation to a fresh background agent that picks the work up immediately. |

## The GitHub issue workflow

Issue-aware commands (`/execute-issue`, `/update-issue`, `/comment-issue`,
`/ship-note`) all resolve "which issue am I working on?" from the current branch,
using the precedence in `.agents/rules/issue-resolution.md`: a leading numeric
branch segment first, then a linked PR's `Closes #N`, then a title-slug fuzzy
match, and only then asking you directly. They reach GitHub through the GitHub MCP
server registered in `.mcp.json` / `opencode.json`, which needs a `GITHUB_TOKEN` in
`.env` (see the root README's "GitHub MCP server" section).

A typical single-issue flow:

```
/create-issue "add CSV export to the reports page"   # creates the issue + plan
git checkout -b 42-csv-export                          # branch name carries the issue number
/execute-issue                                          # Phase 1 confirm, Phase 2 implement
/ship-note                                               # record what happened, issue stays open
```

## Parallel orchestration: epics and children

For specs too large for one branch, `.agents/rules/parallel-orchestration.md` defines
an **epic/child** model: an epic issue holds a child task-list and a
` ```waves ` dependency graph; each child is a normal full-plan issue prefixed with
`> Epic: #<n>` and `> Depends on: #…`. Children branch off a real, long-lived
**epic integration branch** (`epic/<n>-<slug>`) — never off `main` directly — and
`.agents/scripts/run-parallel-issues.sh` runs one git worktree + one headless agent
per child, auto-merging each success back into the epic branch as soon as it's
pushed. Waves advance automatically; there is no manual merge checkpoint between
them. `main` only receives the work once, through a single `epic → main` PR opened
after every child is integrated.

```
/spec path/to/big-spec.md    # spec-breakdown, review, then execute-epic — chained
```

or drive the two phases yourself with `/spec-breakdown` followed by `/execute-epic`
when you want to review the decomposition before any execution starts.

One-time setup before the first `/execute-epic`: copy
`.agents/parallel.config.example` → `.agents/parallel.config` and set
`AGENT_EXEC_CMD` (defaults to `claude -p --dangerously-skip-permissions`; Codex and
OpenCode adapters are documented in the same file). Fill in `## Commands` ›
`Build:` / `Test:` in `AGENTS.md` so child agents have real acceptance checks to run.

Safety caps live in the same rule file: `MAX_CHILDREN=12`,
`PARALLEL_MAX_CONCURRENCY=3`, `AGENT_TIMEOUT=1800s`. `GITHUB_TOKEN` is never sourced
by the runner — headless child agents have no GitHub access by design; all GitHub
API calls are made by the orchestrating agent's own session via MCP.

## Installing this scaffold elsewhere

`/custom-init [target-dir]` runs the manifest-driven copier
(`.agents/scripts/init-scaffold.sh`), which reads `.agents/scaffold.manifest` —
a flat list of files and recursive directories — and copies every entry into the
target, skipping (never overwriting) anything that already exists there. It is
always safe to re-run. To add something new to what every adopting project
receives, add a line to the manifest rather than embedding a template anywhere
else; the manifest and the copier script are the single source of truth for what
gets installed.

## Verifying the scaffold itself

If you are working on this scaffold's own source (not a project that adopted it),
`sh .agents/scripts/verify-scaffold.sh` is the zero-dependency acceptance gate. It
checks: required root/governance files exist; every command spec has both a Claude
and an OpenCode wrapper; every wrapper declares a `description:` field; every script
under `.agents/scripts/` parses cleanly with `sh -n` and is executable; every
`.agents/scaffold.manifest` entry resolves to a real path; and no stack-specific
artifacts (`src/`, `src-tauri/`, `package.json`) are tracked. Exit status is the
number of failed checks — `0` means clean.

## After adopting the scaffold in a real project

Fill in the placeholders this scaffold ships with `_not yet documented_` markers:
`AGENTS.md` › `## Workspace`, `## Commands`, `## Verification Quirks`, `## Skills`,
`## Code Structure`; `.agents/ubiquitous-language.md`'s `Last updated` date and
canonical domain code path; and the canonical domain paths in
`.agents/rules/domain-glossary.md`. None of the workflow above changes once you do
— it's the same plan → implement → verify → ship loop, now pointed at your stack's
real lint/build/test commands instead of placeholders.
