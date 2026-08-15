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
| `/install-scaffold` | Installing this scaffold into a target project (see below). |
| `/create-issue` | Turning a requirement description into a GitHub issue with a full plan in its body. |
| `/update-issue` | Correcting an issue's body/title when the first generation was off. |
| `/execute-issue` | Executing the current branch's linked issue, two phases: confirm, then implement. |
| `/comment-issue` | Adding a comment to the current branch's issue thread without touching state. |
| `/ship-note` | Posting a comment describing what actually shipped, once work is done. |
| `/spec-breakdown` | Decomposing a large spec into an epic issue + dependency-graphed child issues. |
| `/execute-epic` | Running an epic's children wave-by-wave in parallel worktrees — push, agentic review, automatic rework on a hard violation, integrate — with nobody watching, then opening one PR. |
| `/supervise-epic` | The same staged pipeline as `/execute-epic`, with your explicit approve/reject decision per child at the review gate before it integrates. User-invocable only. |
| `/spec` | One-shot: `/spec-breakdown` then, by default, `/execute-epic`, chained. Add `--supervised` to route execution through `/supervise-epic` instead. |
| `/handoff` | Passing this conversation to a fresh background agent that picks the work up immediately. |

## Skills

A command is something *you* start. A **skill** is something the *agent* starts — a
procedure it loads on its own the moment the situation matches the skill's
`description`. You never type its name; you just find the agent already following it.

Each skill keeps one canonical body at `.agents/skills/<name>/SKILL.md`, which OpenCode
reads natively, plus a relative symlink at `.claude/skills/<name>`, which is the only
place Claude Code looks. One real file, two agents, no drift possible
(`.agents/rules/skill-creation.md`; the reasoning and the rejected alternatives are in
`.agents/adr/0001-skills-canonical-in-agents-skills.md`).

| Skill | Fires when |
|---|---|
| `resolving-merge-conflicts` | A git merge or rebase is mid-conflict. Reconstructs the intent behind each side, resolves every hunk without inventing behavior, runs the project's checks, and finishes the merge. |
| `standards-and-spec-review` | A branch needs checking on two axes at once — **Standards** (does it follow `AGENTS.md`, `.agents/rules/`, the glossary, and the ADRs?) and **Spec** (does it implement the issue, plan, or spec it came from?). Each axis runs in its own sub-agent and the two reports are presented side by side, never reranked against each other. Not a correctness-bug hunt — that is `/code-review`. |

One caveat worth knowing before you add your own: a skills directory that did not exist
when the agent started is not watched. Restart the agent after adding the first one.

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
per child. `main` only receives the work once, through a single `epic → main` PR
opened after every child is integrated.

A child no longer merges the instant it's pushed. It passes through a **review
gate** first: the runner fans out an agentic `standards-and-spec-review` against the
epic branch as the fixed point, and only a child that clears the gate gets
integrated. Two commands run the identical pipeline — push → agentic review →
optional rework → integrate — and differ only in who resolves what the review
finds:

- **`/execute-epic`** (auto) — runs end to end with nobody watching. A **hard
  violation** (a breach of the glossary or an ADR) blocks integration and triggers
  automatic rework instead of a prompt; a **judgement call** never blocks — it lands
  only in the child's ship-note.
- **`/supervise-epic`** — the same pipeline, plus your explicit approve/reject
  decision per child, informed by the diff, the agent log, and the same agentic
  report. A hard violation pre-selects "reject," but you can approve anyway.
  User-invocable only — like `/grill`, it needs somebody there to answer, so it must
  never run inside a headless parallel-runner child.

A rejected child is re-dispatched automatically — up to `MAX_REWORK_ROUNDS` (default
2) — with the review's findings as feedback, then re-reviewed before it gets another
shot at the gate, since a rework can break something the previous round passed.
Waves still advance with no manual merge checkpoint between them.

```
/spec path/to/big-spec.md               # spec-breakdown, review, then execute-epic — chained
/spec path/to/big-spec.md --supervised  # same, but execution routes through supervise-epic
```

or drive the phases yourself with `/spec-breakdown` followed by `/execute-epic` or
`/supervise-epic` when you want to review the decomposition before any execution
starts.

One-time setup before the first `/execute-epic` or `/supervise-epic`: copy
`.agents/parallel.config.example` → `.agents/parallel.config` and set
`AGENT_EXEC_CMD` (defaults to `claude -p --dangerously-skip-permissions`; Codex and
OpenCode adapters are documented in the same file). Optionally set
`REVIEW_AGENT_EXEC_CMD` to give the agentic reviewer a different model than the
implementer — empty inherits `AGENT_EXEC_CMD`, it never means "skip the review."
Fill in `## Commands` › `Build:` / `Test:` in `AGENTS.md` so child agents have real
acceptance checks to run.

Safety caps live in the same rule file: `MAX_CHILDREN=12`,
`PARALLEL_MAX_CONCURRENCY=3`, `AGENT_TIMEOUT=1800s`, `MAX_REWORK_ROUNDS=2` (`0`
disables rework, so a rejection simply blocks the child). `GITHUB_TOKEN` is never
sourced by the runner — headless child agents have no GitHub access by design; all
GitHub API calls are made by the orchestrating agent's own session via MCP.

## Installing this scaffold elsewhere

`/install-scaffold [target-dir]` runs the manifest-driven copier
(`.agents/scripts/install-scaffold.sh`), which reads `.agents/scaffold.manifest` —
a flat list of files and recursive directories — and copies every entry into the
target, skipping (never overwriting) anything that already exists there. It is
always safe to re-run. To add something new to what every adopting project
receives, add a line to the manifest rather than embedding a template anywhere
else; the manifest and the copier script are the single source of truth for what
gets installed.

## Verifying the scaffold itself

`sh .agents/scripts/verify-scaffold.sh` is the zero-dependency acceptance gate. It
checks, in nine groups: required root/governance files exist; every command spec has
both a Claude and an OpenCode wrapper *and* a `# Command: <name>` heading matching its
filename; the two wrappers are byte-identical below their frontmatter; every wrapper
declares a `description:` field; every script under `.agents/scripts/` parses cleanly
with `sh -n` and is executable; every `.agents/scaffold.manifest` entry resolves to a
real path; no stack-specific artifacts (`src/`, `src-tauri/`, `package.json`) are
tracked; every skill has a `SKILL.md` whose `name` matches its directory, declares a
`description`, and is symlinked into `.claude/skills/`; and — the reverse of the
manifest check — every ADR and `*.example` file is actually listed in the manifest, so
nothing lands referenced-but-not-shipped. Exit status is the number of failed checks —
`0` means clean.

Run it in an adopted project too, not just here. The four checks that only make sense
in the scaffold's own source tree are gated on `.agents/scaffold.manifest` being
present, and the manifest is deliberately not listed in itself — so it never reaches an
adopting project, where those checks report as skipped and the rest still run.

## After adopting the scaffold in a real project

Fill in the placeholders this scaffold ships with `_not yet documented_` markers:
`AGENTS.md` › `## Workspace`, `## Commands`, `## Testing`, `## Verification Quirks`,
`## Code Structure`; `.agents/ubiquitous-language.md`'s `Last updated` date and
canonical domain code path; and the canonical domain paths in
`.agents/rules/domain-glossary.md`. Leave `AGENTS.md` › `## Skills` alone — it is
already populated, and it describes skills you inherit rather than a blank to fill.

Two things carry over rather than starting fresh. ADRs `0001`–`0007` ship with the
scaffold, recording decisions your project inherits, so your own first ADR starts at
`0008`. And your agent must be restarted once after the install, or it will not
discover `.claude/skills/` — a skills directory that did not exist at startup is not
watched.

None of the workflow above changes once you do — it's the same plan → implement →
verify → ship loop, now pointed at your stack's real lint/build/test commands instead
of placeholders.
