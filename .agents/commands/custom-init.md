# Command: custom-init

Bootstrap the cross-agent governance scaffold in the current project directory.

## Purpose

This command creates the full cross-agent governance architecture in the current
working directory — rules, ubiquitous language, and slash commands (Claude Code,
OpenCode). It is safe to run repeatedly: any file that already
exists is skipped and reported.

Files created (49 total):

1. `.agents/rules/plan-creation.md`
2. `.agents/rules/domain-glossary.md`
3. `.agents/rules/command-creation.md`
4. `.agents/ubiquitous-language.md`
5. `.agents/commands/commit-message.md`
6. `.agents/commands/planning.md`
7. `.agents/commands/custom-init.md`
8. `.claude/commands/commit-message.md`
9. `.claude/commands/planning.md`
10. `.claude/commands/custom-init.md`
11. `.opencode/commands/commit-message.md`
12. `.opencode/commands/planning.md`
13. `.opencode/commands/custom-init.md`
14. `CLAUDE.md`
15. `AGENTS.md`
16. `.agents/plans/.gitkeep`
17. `.agents/skills/.gitkeep`
18. `.agents/rules/issue-resolution.md`
19. `.agents/commands/create-issue.md`
20. `.agents/commands/execute-issue.md`
21. `.agents/commands/update-issue.md`
22. `.agents/commands/comment-issue.md`
23. `.agents/commands/ship-note.md`
24. `.claude/commands/create-issue.md`
25. `.claude/commands/execute-issue.md`
26. `.claude/commands/update-issue.md`
27. `.claude/commands/comment-issue.md`
28. `.claude/commands/ship-note.md`
29. `.opencode/commands/create-issue.md`
30. `.opencode/commands/execute-issue.md`
31. `.opencode/commands/update-issue.md`
32. `.opencode/commands/comment-issue.md`
33. `.opencode/commands/ship-note.md`
34. `.agents/scripts/run-github-mcp.sh`
35. `.mcp.json`
36. `opencode.json`
37. `.gitignore`
38. `.agents/rules/parallel-orchestration.md`
39. `.agents/scripts/run-parallel-issues.sh`
40. `.agents/parallel.config.example`
41. `.agents/commands/spec-breakdown.md`
42. `.agents/commands/execute-epic.md`
43. `.agents/commands/spec.md`
44. `.claude/commands/spec-breakdown.md`
45. `.claude/commands/execute-epic.md`
46. `.claude/commands/spec.md`
47. `.opencode/commands/spec-breakdown.md`
48. `.opencode/commands/execute-epic.md`
49. `.opencode/commands/spec.md`

## Instructions

1. Check what already exists in the current directory. If shell injection output is
   visible above (ls and find results), use that to determine which governance files
   already exist. Otherwise, use your file-listing tools to inspect the working directory.

2. For each file in the manifest above, in order:
   - If the file already exists: print `⊘ skipped: <path>` and move on.
   - If it does not exist: create it using the exact content in the Templates section
     below, then print `✓ created: <path>`.
   - For `.gitkeep` files (items 16–17): create an empty file (zero bytes).
   - For `.agents/scripts/run-github-mcp.sh` (item 34): create it with the template content,
     then mark it executable — run `chmod +x .agents/scripts/run-github-mcp.sh`.
   - For `.agents/scripts/run-parallel-issues.sh` (item 39): create it with the template
     content, then mark it executable — run `chmod +x .agents/scripts/run-parallel-issues.sh`.
   - For `.agents/commands/custom-init.md` (item 7): write the full content of this
     command file to that path. If running from a globally installed command at
     `~/.claude/commands/custom-init.md`, read that file and copy its contents verbatim.

3. After processing all files, print a summary:
   ```
   Scaffold initialized.
   Created: N files
   Skipped: N files (already existed)
   ```

4. Remind the user to fill in the TODO placeholders in `AGENTS.md`:
   - `## Workspace` — package manager, Node version, monorepo tool, apps/packages list
   - `## Commands` — dev, build, lint, type-check, test, format commands
   - `## Verification Quirks` — non-obvious CI/lint behaviors
   - `## Skills` — any workspace-wide skills in `.agents/skills/`
   - `## Code Structure` — framework, router style, key directories

5. Remind the user to customize `.agents/ubiquitous-language.md`:
   - Replace `[YYYY-MM-DD]` with today's date
   - Replace `[TODO: path...]` with the canonical types path for this project
   - Replace or remove the Example placeholder row in Core Entities
   - Update the Changelog date placeholder

6. Remind the user to customize `.agents/rules/domain-glossary.md`:
   - Replace the two `[TODO: e.g. ...]` lines under "Canonical domain code paths"
     with actual paths where domain entities live in this project

7. Remind the user to configure the **GitHub MCP server** — the GitHub issue commands are inert
   without it:
   - Set `GITHUB_TOKEN` in `.env` to a GitHub Personal Access Token with `repo` scope.
   - Ensure `.env` is gitignored — it holds the token. (`.mcp.json` and `opencode.json` carry no
     secrets and are safe to commit.)
   - Restart Claude Code / OpenCode so the newly registered MCP server is loaded.
   - Install the server with `brew install github-mcp-server` (it must be on PATH). This is
     GitHub's official MCP server; it replaces the deprecated npm package
     `@modelcontextprotocol/server-github`.

8. Remind the user to set up the **parallel orchestration runner** — needed for
   `/spec-breakdown`, `/execute-epic`, and `/spec`:
   - Copy `.agents/parallel.config.example` → `.agents/parallel.config` (gitignored —
     contains no secrets; never commit it).
   - Set `AGENT_EXEC_CMD` (default: `claude -p --dangerously-skip-permissions`).
   - Fill in real `Build:` and `Test:` commands under `## Commands` in `AGENTS.md` so
     child agents know what acceptance checks to run (e.g. `xcodebuild … build` for Swift,
     `pnpm lint && pnpm build` for Node).
   - The runner is already executable if `/custom-init` marked it (step 2 above).

9. Optional global install tip:
   To use `/custom-init` in any project (not just this one), install it globally:
   ```bash
   cp .agents/commands/custom-init.md ~/.claude/commands/
   ```

---

## Templates

### File: .agents/rules/plan-creation.md

````
# Rule: Plan Creation & Persistence

When entering plan mode or creating an implementation plan, **always** save the plan as a markdown file in `.agents/plans/` so that any model (including less capable ones) can pick it up and execute it without ambiguity.

## Cross-Agent Compatibility

This file is the canonical source of truth for cross-agent planning in this repository.

- OpenCode enters this workflow through `AGENTS.md`.
- Claude enters this workflow through `CLAUDE.md` and `AGENTS.md`.

### Read-Only Plan Mode

If the active agent is in a read-only planning mode and cannot write files yet, it must still draft the full plan in-chat using the exact structure in this rule. The plan should then be saved to `.agents/plans/[yyyy-mm-dd]-[short-kebab-description].md` as soon as write access is available.

---

## When This Rule Applies

- You are asked to plan a feature, migration, refactor, or any non-trivial task
- You enter plan mode (`/plan` or equivalent)
- The user explicitly asks for a plan before implementation
- A task is complex enough that you would naturally break it into multiple steps

---

## File Location & Naming

```
.agents/plans/
└── [yyyy-mm-dd]-[short-kebab-description].md
```

Example: `.agents/plans/2026-03-17-add-user-profile-page.md`

- Use the current date as prefix for chronological ordering
- Use kebab-case for the description portion
- Keep the filename under 60 characters

---

## Required Plan Structure

Every plan file **must** include all of the following sections:

```markdown
# Plan: [Human-Readable Title]

> Status: **draft** | **approved** | **in-progress** | **completed** | **abandoned**
> Created: [YYYY-MM-DD]
> Updated: [YYYY-MM-DD]
> Issue: #N (optional — GitHub issue this plan implements)

## Goal

One or two sentences describing **what** we are building and **why**.

## Context

- What exists today (current state)
- What prompted this work (trigger)
- Any constraints, deadlines, or dependencies the implementer must know

## Affected Files

List **every** file that will be created, modified, or deleted. Use the full path from the project root. Mark each with its action:

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/features/[feature]/page.tsx` | Page orchestrator |
| MODIFY | `src/services/[service].ts` | Add new method |
| DELETE | `src/old-file.ts` | No longer needed |

## Step-by-Step Implementation

Number every step. Each step must be **atomic** (one clear action) and include:

1. **What to do** — the exact action (create file, add function, modify config, etc.)
2. **Where** — the full file path
3. **How** — the specific code or logic to write, in enough detail that a model with no prior context can implement it without guessing. Include:
   - Function signatures with parameter types and return types
   - Key logic or algorithm in pseudocode or actual code snippets
   - Imports that will be needed
   - Which existing patterns/files to reference as examples
4. **Why** — one sentence on the rationale (helps the implementer make judgment calls)

### Example step format:

> **Step 3 — Create the feature adapter**
>
> - **File:** `src/adapters/[feature].adapter.ts`
> - **Action:** CREATE
> - **Details:**
>   - Export a function `[feature]_adapter(rows: Record<string, string>[]): IFeature[]`
>   - Map each row using the `EFeatureConversion` enum for field names
>   - Reference `src/adapters/existing.adapter.ts` for the pattern
> - **Why:** Transforms raw data rows into typed domain objects

## Architecture Decisions

Document any non-obvious choices made during planning:

- Why a particular approach was chosen over alternatives
- Trade-offs accepted
- Patterns being followed (reference the rule file)

## Validation Criteria

How to verify the plan was implemented correctly:

- [ ] Specific acceptance checks
- [ ] Build passes
- [ ] Lint passes
- [ ] Manual smoke test steps if applicable

## Open Questions

List anything unresolved that needs user input before or during implementation. If none, write "None."
```

---

## Rules for Writing Plans

1. **Be exhaustive over concise** — another model will read this with zero context. Over-explain rather than assume knowledge.
2. **Include actual code snippets** for any non-trivial logic — interfaces, function signatures, config objects.
3. **Reference existing files as examples** — "follow the same pattern as `src/adapters/example.adapter.ts`" gives the implementer a concrete anchor.
4. **List every import** that a new file will need.
5. **Specify the order** — steps must be sequenced so that dependencies are created before dependents.
6. **No vague steps** — "set up the service" is not a valid step. "Create `src/services/foo.service.ts` exporting `foo_service.get(signal?: AbortSignal)`" is.
7. **Flag blockers** — if a step depends on user input, an env var, or an external action, call it out explicitly.
8. **Update the status** — when starting or completing the plan, update the `Status` field.

---

## Workflow

1. **Draft** — Create the plan file, present it to the user for review.
2. **Approve** — User confirms or requests changes. Update status to `approved`.
3. **Implement** — Execute steps in order. Update status to `in-progress`.
4. **Complete** — All validation criteria pass. Update status to `completed`.

If the plan is abandoned or superseded, update status to `abandoned` and note why.
````

---

### File: .agents/rules/domain-glossary.md

```
# Rule: Domain Glossary Check

**Before touching any domain code you MUST read `.agents/ubiquitous-language.md`.**

## What counts as domain code

A file is domain code if it:
- Lives in a path this project designates as canonical domain code (list those paths below)
- Names, exports, or imports an entity listed in the glossary

> **Project setup required:** Replace the placeholder list below with the actual canonical
> domain code paths for this project (e.g. `packages/models/src/`, `src/domain/`, `src/entities/`).

**Canonical domain code paths for this project:**
- `[TODO: e.g. packages/models/src/]`
- `[TODO: e.g. src/domain/]`

## What to verify before editing

1. **Entity name** — use the canonical term, not an alias-to-avoid.
2. **Canonical type** — confirm the correct interface / schema name and its package.
3. **Aliases to avoid** — check the "Aliases to avoid" column; do not introduce them.
4. **Relationships** — ensure FKs, join tables, and cascade rules match the "Relationships" section.
5. **Auth processes** — if adding or renaming an endpoint, check for correct trigger routes and terminology.

## What to do after editing domain code

If you introduce a new entity, state, or process:
- Add it to `.agents/ubiquitous-language.md` under the correct section.
- Bump "Last updated".
- Add a row to the Changelog table.

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/domain-glossary.md` and `@.agents/ubiquitous-language.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` Domain section |
```

---

### File: .agents/rules/command-creation.md

````
# Rule: Cross-Agent Command Creation (Claude Code + OpenCode)

Slash commands target Claude Code and OpenCode, which share the same command feature
set. Keep one canonical spec in `.agents/commands/` and add a thin wrapper per agent
that references it — the same bridge pattern used for rules and the domain glossary.

## Layout

```
.agents/commands/<name>.md     # canonical, agent-agnostic spec (source of truth)
.claude/commands/<name>.md     # Claude Code wrapper
.opencode/commands/<name>.md   # OpenCode wrapper
```

Invoke in either agent with `/<name>`.

## Shared feature set

Claude Code and OpenCode both support:

- **YAML frontmatter** — at minimum `description`.
- **Shell injection** — `` !`cmd` `` runs the command and inlines its output before the
  model sees the prompt. The `!` must start the line.
- **File include** — `@path/to/file.md` inlines that file's contents.
- **Arguments** — `$ARGUMENTS` (all args); positional `$1`, `$2`, …

Because the feature set is identical, the two wrappers have **identical bodies** and
differ only in agent-specific frontmatter:

| Field | Claude Code | OpenCode |
|-------|-------------|----------|
| `description` | yes | yes |
| `allowed-tools` (pre-approve injected shell) | yes | n/a (permissions are agent-level) |
| `disable-model-invocation` (user-only) | yes | n/a |
| model / agent selection | `model` | `agent`, `model` |

## How to add a command

1. **Canonical spec** — `.agents/commands/<name>.md`: purpose, the shell context the
   command needs (exact commands), and agent-neutral instructions. No agent-specific syntax.
2. **Claude wrapper** — `.claude/commands/<name>.md`: frontmatter (`description`,
   `allowed-tools` for any injected shell, optional `argument-hint` /
   `disable-model-invocation`), the `` !`cmd` `` injection lines, `$ARGUMENTS`, then
   `@.agents/commands/<name>.md`.
3. **OpenCode wrapper** — `.opencode/commands/<name>.md`: the **same body** as the Claude
   wrapper, with frontmatter reduced to `description` (add `agent` / `model` only if needed).

## Orchestration commands

A command may invoke a project script under `.agents/scripts/` **as a model tool call
during execution** — for example, calling the parallel runner with model-computed
arguments. This is distinct from a `` !`cmd` `` shell injection, which executes once
before the model sees the prompt and cannot use model-computed arguments.

Wrapper **bodies stay identical** across Claude Code and OpenCode; only the frontmatter
differs (the same frontmatter-only divergence that already applies to injected shell):

- **Claude Code:** pre-approve the call via
  `allowed-tools: Bash(sh .agents/scripts/<script>:*)`.
- **OpenCode:** the agent-level permission setting authorizes the call.

## Rules

- The canonical spec is the single source of truth; wrappers must not diverge in intent.
- Keep the Claude and OpenCode wrapper **bodies identical** — only frontmatter may differ.
- Keep `` !`cmd` `` injection lines clean — the `!` must start the line.
- When you add a command, list it under `## Slash Commands` in `AGENTS.md`.
````

---

### File: .agents/ubiquitous-language.md

```
# Ubiquitous Language

> Single source of truth for domain terminology. Update when entities, relationships,
> or naming conventions change. AI tools should read this before inspecting source files.
>
> **Last updated**: [YYYY-MM-DD]
> **Canonical types**: [TODO: path/to/domain/types, e.g. packages/models/src/]

---

## How to maintain this document

1. **Add terms** when a new entity, state, or process enters the codebase.
2. **Add aliases to avoid** when ambiguity appears in PRs, chats, or AI-generated code.
3. **Update relationships** when entity connections change (new FK, removed link, etc.).
4. **Flag ambiguities** when a term means different things in different contexts.
5. **Bump "Last updated"** on every edit so AI tools know how fresh the context is.

---

## Core entities

_None yet._

| Term | Definition | Canonical type | Aliases to avoid |
|------|-----------|----------------|-----------------|
| **Example** | _Replace with your first real entity_ | `ExampleType` in `[path]` | — |

---

## Relationships

_None yet._

---

## Flagged ambiguities

_None yet._

---

## Changelog

| Date | Change | Reason |
|------|--------|--------|
| [YYYY-MM-DD] | Initial scaffold | Project created |
```

---

### File: .agents/commands/commit-message.md

```
# Command: commit-message

Generate a clear, professional commit message from the current repository changes.

## Source of changes

The wrapper injects the current diff — staged (`git diff --cached`) and unstaged
(`git diff`). Base the message on it, prioritizing staged over unstaged.

## Instructions

- Produce **a single commit message** that is clear, concise, and professional.
- Use **Conventional Commits** when appropriate: `type(scope): short description`
  (types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `ci`, `build`).
- Subject line (first line) **maximum 72 characters**.
- Add a body (what changed and why) only when the changes justify it; wrap body lines at ~72 chars.
- Start with an emoji when it feels natural (✨ feat, 🐛 fix, ♻️ refactor, etc.).
- Prioritize staged changes; if nothing is staged, use the unstaged changes.
- If an extra hint or scope was provided, weight the message toward it.
- If there are no changes at all, reply that there is nothing to commit.
- Return **only the commit message** — no explanations, no surrounding prose, no code fences —
  ready to paste into `git commit`.
```

---

### File: .agents/commands/planning.md

```
# Command: planning

Create a thorough implementation plan for a requested feature, migration, or refactor, and persist it in `.agents/plans/`.

## Purpose

This command produces a plan file that:
- Can be picked up by any model (including less capable ones) and executed without ambiguity
- Gives the user a reviewable artifact before any code is written
- Serves as a lightweight architectural decision record after implementation

## Instructions

When invoked with a task description:

1. **Inspect context** — read the relevant source files, rules, and existing plans to understand the current state. Do not skip this step even for seemingly simple tasks.
2. **Draft the plan** — produce a complete plan following `.agents/rules/plan-creation.md` exactly. Be exhaustive: another model will execute this with zero prior context.
3. **Save the plan** — write it to `.agents/plans/[yyyy-mm-dd]-[short-kebab-description].md` with status `draft`.
4. **Present for review** — respond with the file path and a concise summary. Do not implement until the user explicitly approves.

## Rules

- Do not edit any production files.
- Do not write any implementation code.
- Prefer small, incremental steps.
- Include every file likely to change, ordered by dependency.
- Include open questions only when they genuinely block execution.
- Follow the full plan structure defined in `.agents/rules/plan-creation.md`.
```

---

### File: .agents/commands/custom-init.md

> **Self-referential template.** Write the full content of this command file to
> `.agents/commands/custom-init.md` in the project. If running from a globally installed
> command at `~/.claude/commands/custom-init.md`, read that file and copy its contents
> verbatim. This ensures the project has a local copy of the canonical spec that local
> wrappers (`.claude/commands/custom-init.md`, `.opencode/commands/custom-init.md`) can
> reference via `@.agents/commands/custom-init.md`.

---

### File: .claude/commands/commit-message.md

```
---
description: Generate a clear, professional commit message from the current changes (staged + unstaged)
argument-hint: [optional emphasis or scope]
allowed-tools: Bash(git diff:*)
disable-model-invocation: true
---

Staged changes:
!`git diff --cached`

Unstaged changes:
!`git diff`

Extra hint (optional): $ARGUMENTS

@.agents/commands/commit-message.md
```

---

### File: .claude/commands/planning.md

```
---
description: Create a careful implementation plan before coding and persist it in .agents/plans/
argument-hint: [task description]
disable-model-invocation: true
---

Create an implementation plan for:

$ARGUMENTS

@.agents/commands/planning.md
@.agents/rules/plan-creation.md
```

---

### File: .claude/commands/custom-init.md

```
---
description: Bootstrap the cross-agent governance scaffold in the current project
argument-hint: "(no arguments needed)"
allowed-tools: Bash(ls:*), Bash(find:*)
disable-model-invocation: true
---

Current directory:
!`ls -la`

Existing governance files:
!`find . -maxdepth 4 \( -name "CLAUDE.md" -o -name "AGENTS.md" -o -name ".agents" -o -name ".claude" -o -name ".opencode" \) 2>/dev/null | sort`

@.agents/commands/custom-init.md
```

---

### File: .opencode/commands/commit-message.md

```
---
description: Generate a clear, professional commit message from the current changes (staged + unstaged)
---

Staged changes:
!`git diff --cached`

Unstaged changes:
!`git diff`

Extra hint (optional): $ARGUMENTS

@.agents/commands/commit-message.md
```

---

### File: .opencode/commands/planning.md

```
---
description: Create a careful implementation plan before coding and persist it in .agents/plans/
---

Create an implementation plan for:

$ARGUMENTS

@.agents/commands/planning.md
@.agents/rules/plan-creation.md
```

---

### File: .opencode/commands/custom-init.md

```
---
description: Bootstrap the cross-agent governance scaffold in the current project
---

Current directory:
!`ls -la`

Existing governance files:
!`find . -maxdepth 4 \( -name "CLAUDE.md" -o -name "AGENTS.md" -o -name ".agents" -o -name ".claude" -o -name ".opencode" \) 2>/dev/null | sort`

@.agents/commands/custom-init.md
```

---

### File: CLAUDE.md

```
@AGENTS.md
@.agents/rules/plan-creation.md
@.agents/rules/domain-glossary.md
@.agents/rules/command-creation.md
@.agents/rules/parallel-orchestration.md
@.agents/ubiquitous-language.md
```

---

### File: AGENTS.md

```
# AGENTS.md

## Plan Workflow
- When asked to plan or when entering plan mode, follow `.agents/rules/plan-creation.md`.
- Persist plans in `.agents/plans/[yyyy-mm-dd]-[short-kebab-description].md`.
- Present the draft for review before implementation.
- Keep the plan status updated through `draft`, `approved`, `in-progress`, `completed`, or `abandoned`.

## Domain
- The canonical domain glossary lives at `.agents/ubiquitous-language.md`.
- Full enforcement rules are in `.agents/rules/domain-glossary.md`. Follow without exception.
- Read `.agents/ubiquitous-language.md` before writing or reviewing any code that touches domain entities, type names, or data contracts.
- Update the glossary (and bump "Last updated") whenever a new entity, state, or process is introduced.

## Workspace
<!-- TODO: describe the package manager, Node version, monorepo tool (if any), and app/package structure -->
- Package manager: [pnpm / npm / yarn] @ [version]
- Node: [>=18 or specific]
- Monorepo: [yes — Turborepo / no — single-package]
- Apps: [list]
- Packages: [list]

## Commands
<!-- TODO: list the project's standard commands -->
- Dev: `[command]`
- Build: `[command]`
- Lint: `[command]`
- Type check: `[command]`
- Test: `[command]`
- Format: `[command]`

## Verification Quirks
<!-- TODO: document any non-obvious verification behaviours (e.g. strict lint, generated types, build order) -->
_None documented yet._

## Skills
<!-- TODO: document where skills live and any workspace-wide skills already in .agents/skills/ -->
- Workspace-wide skills: `.agents/skills/`
- App-specific skills: `apps/<app>/.agents/skills/`
- Package-specific skills: `packages/<pkg>/.agents/skills/`
- Prefer the narrowest ownership boundary that still matches real usage.

## Slash Commands
- Cross-agent slash commands (Claude Code + OpenCode) follow `.agents/rules/command-creation.md`.
- Canonical specs live in `.agents/commands/<name>.md`; thin wrappers in `.claude/commands/` and `.opencode/commands/` reference them with identical bodies (only frontmatter differs).
- Invoke in either agent with `/<name>`.
- Available: `commit-message` — generate a Conventional-Commits message from the current diff.
- Available: `planning` — create a thorough implementation plan and persist it in `.agents/plans/`.
- Available: `custom-init` — bootstrap the full cross-agent governance scaffold in the current project.
- Available: `create-issue` — create a GitHub issue with a full implementation plan from a requirement description.
- Available: `update-issue` — correct the body (and optionally the title) of the current branch's GitHub issue when the initial generation was inaccurate.
- Available: `execute-issue` — execute the current branch's GitHub issue in two phases (confirm, implement); uses the linked `.agents/plans/` file as primary plan source if one exists.
- Available: `comment-issue` — add a comment to the thread of the GitHub issue for the current branch.
- Available: `ship-note` — post a ship-note of the executed work to the current branch's issue (does not close it).
- Available: `spec-breakdown` — decompose a large spec into an epic issue + N child issues with a dependency graph.
- Available: `execute-epic` — execute an epic's child issues in parallel (one wave/frontier per run), then open PRs.
- Available: `spec` — one-shot: break a spec into an epic + children, then execute them in parallel.

## GitHub MCP server
- The GitHub issue commands (`create-issue`, `update-issue`, `execute-issue`,
  `comment-issue`, `ship-note`) reach GitHub through the
  **GitHub MCP server**, registered in `.mcp.json` (Claude Code) and `opencode.json` (OpenCode).
- Both registrations point at `.agents/scripts/run-github-mcp.sh`, which sources `.env` and
  launches the official `github-mcp-server` over stdio.
- Install the server binary with `brew install github-mcp-server` (it must be on PATH; the
  script also prepends the Homebrew bin dirs for GUI-launched agents). This replaces the
  deprecated npm package `@modelcontextprotocol/server-github`.
- Set `GITHUB_TOKEN` in `.env` (a GitHub Personal Access Token with `repo` scope). The script
  exposes it to the server as `GITHUB_PERSONAL_ACCESS_TOKEN`.
- Restart the agent after first configuring the token so the MCP server is picked up.

## Parallel Orchestration

Decompose a large spec into an epic + N child issues and execute them in parallel via a POSIX
shell runner. Full conventions in `.agents/rules/parallel-orchestration.md`.

**Epic/child model:** An *epic* is a GitHub issue with a child task-list + ` ```waves ` graph
block. Each *child* is a full-plan issue with `> Epic: #<n>` and `> Depends on: #…` headers.
Children use branch names `<issue#>-<kebab-title>`; epic branches may be `epic/<slug>`.

**Setup (one-time):**
1. Copy `.agents/parallel.config.example` → `.agents/parallel.config` (gitignored).
2. Set `AGENT_EXEC_CMD` (default: `claude -p --dangerously-skip-permissions`).
3. Ensure `Build:` and `Test:` in `## Commands` above are filled in — child agents read them.

**Runner:** `.agents/scripts/run-parallel-issues.sh` — one worktree + headless agent per child,
concurrent up to `PARALLEL_MAX_CONCURRENCY` (default 3). The runner commits and pushes each
successful branch; the orchestrating agent opens PRs via MCP. `GITHUB_TOKEN` is never sourced
by the runner — headless agents have no GitHub access by design.

**Wave flow:** `/execute-epic` runs the current frontier (dependency-satisfied, not-yet-done
children) in parallel, opens PRs (`Closes #<child>`), ticks the epic task-list, then **stops**
asking you to merge this wave's PRs before the next wave. Re-running advances (idempotent).

**Safety caps:** `MAX_CHILDREN=12`, `AGENT_TIMEOUT=1800s`, `PARALLEL_MAX_CONCURRENCY=3`.
Override in `.agents/parallel.config`.

## Code Structure
<!-- TODO: document the framework, router style, key directories, and any import conventions -->
_None documented yet._
```

---

### File: .agents/plans/.gitkeep

(empty file — no content)

---

### File: .agents/skills/.gitkeep

(empty file — no content)

---

### File: .agents/rules/issue-resolution.md

```
# Rule: Resolve the GitHub Issue from the Current Branch

Shared by every issue-aware slash command (`/execute-issue`, `/update-issue`,
`/comment-issue`, `/ship-note`). Each of those commands must map
the **current branch** to exactly one existing GitHub **issue** (never a pull request) before
doing its work, using the precedence below.

## Context injected by the wrapper

- **Repository remote URL** — parse `owner` and `repo` from the injected
  `git remote get-url origin` output (supports HTTPS and SSH). GitHub redirects renamed repos,
  so the slug from the remote is always valid for the API.
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Precedence order

Stop at the first that yields a verified, existing **issue** (not a PR):

1. **Leading numeric segment** — strip a leading `user/` segment and any conventional-commit
   type prefix (`feat/`, `fix/`, `chore/`, `feat-`, `fix-`, `chore-`), then take the first bare
   numeric token (e.g. `15-nextjs-migration` → `15`). Verify with `mcp__github__issue_read` (`method: "get"`).
   Ignore numbers that are part of a Linear-style ID like `sdp-375` (letters-dash-number) —
   those are **not** GitHub issue numbers.
2. **Linked PR** — call `mcp__github__list_pull_requests` with `head: "<owner>:<branch>"` and
   `state: "all"`. If a PR matches the branch, read its body and parse the first
   `Closes|Fixes|Resolves #<n>` reference (case-insensitive). Verify that issue with
   `mcp__github__issue_read` (`method: "get"`).
3. **Title-slug fuzzy match** — derive a description slug from the branch by removing the
   `user/` prefix, any Linear-style `<team>-<number>-` prefix, and conventional-commit type
   tokens; replace `-`/`_` with spaces. Call `mcp__github__list_issues` (`state: "all"`,
   `per_page: 30`), **excluding entries that are pull requests** (those have a `pull_request`
   field or a `/pull/` html_url). Pick the issue whose title best matches the slug.
4. **Ask** — if nothing resolves confidently, list the open issues (number + title) and ask the
   user which one to use. Do not proceed without an answer.

## Epic and child branch shapes (from `/spec-breakdown`)

- **Child branches:** `<issue#>-<kebab-title>` (e.g. `12-keystroke-capture`). The leading
  numeric segment resolves these via precedence #1 above — no special handling required.
- **Epic branch:** may be `epic/<slug>` (e.g. `epic/add-keystroke-counting`). No numeric
  prefix — resolves via title-slug fuzzy match (precedence #3). This note is informational;
  the resolution precedence is unchanged.

## Rules

- A Linear-style token (`sdp-375`) is **not** a GitHub issue number — never treat its digits as one.
- Resolve to an **issue**, never a pull request.
- When in doubt, ask — never guess an issue number for an outward-facing or destructive action.
```

---

### File: .agents/commands/create-issue.md

```
# Command: create-issue

Generate a GitHub issue from a requirement description. The issue body must contain
a full implementation plan following the structure in `.agents/rules/plan-creation.md`,
adapted for GitHub Markdown (no YAML frontmatter, no Status/Created/Updated lines).

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner` and `repo` from the injected `git remote get-url origin` output.

## Instructions

When invoked with a requirement description (`$ARGUMENTS`):

1. **Read the requirement** from `$ARGUMENTS`. If empty, ask the user to provide one.
2. **Parse owner/repo** from the injected remote URL (supports both HTTPS and SSH formats).
3. **Check for duplicates** by calling `mcp__github__list_issues` with `state: "open"` and
   `per_page: 20`. If a near-identical issue exists, tell the user and stop (do not create a duplicate).
4. **Inspect relevant source files** using Read/Bash if needed to understand the codebase
   context required to produce accurate affected-files and step-by-step sections.
5. **Generate the issue title**: concise, action-oriented, ≤ 72 characters.
   - Use Conventional Commits style when appropriate: `feat: ...`, `fix: ...`, `chore: ...`
   - Examples: `feat: add contact form validation`, `fix: courses list empty state`
6. **Generate the issue body** using this exact structure:

   ```
   ## Goal
   One or two sentences: what is being built and why.

   ## Context
   - What exists today
   - What prompted this work
   - Constraints, deadlines, dependencies the implementer must know

   ## Affected Files
   | Action | File Path | Purpose |
   |--------|-----------|---------|
   | CREATE/MODIFY/DELETE | `path/from/root` | one-line purpose |

   ## Step-by-Step Implementation
   Numbered steps. Each step: what, where (full path), how (code snippets,
   function signatures, imports, patterns to follow), why (one sentence).

   ## Architecture Decisions
   Non-obvious choices: why this approach over alternatives, trade-offs, patterns referenced.

   ## Acceptance Criteria
   - [ ] Specific verifiable checks
   - [ ] Project acceptance commands pass (from `AGENTS.md` › Commands, or `ACCEPTANCE_CMD`
         in `.agents/parallel.config`; e.g. `pnpm lint && pnpm build` for Node, or
         `xcodebuild -scheme <App> build` for Swift)
   - [ ] Manual smoke test steps if applicable

   ## Open Questions
   Anything unresolved needing input before or during implementation. If none, write "None."

   ---
   *Generated by `/create-issue`. Run `/planning <description>` when starting
   implementation to create a persisted plan in `.agents/plans/`.*
   ```

7. **Create the issue** by calling `mcp__github__issue_write` (`method: "create"`) with `owner`, `repo`, `title`, and `body`.
8. **Report** the created issue URL to the user.

## Rules

- Be exhaustive in step details — another model will implement from the issue alone.
- Include actual code snippets for non-trivial logic.
- Reference existing files as implementation anchors ("follow the pattern in `src/adapters/courses.adapter.ts`").
- List every import a new file will need.
- Flag blockers (env vars, external actions, user decisions) explicitly.
- Never create a duplicate — check open issues via `mcp__github__list_issues` first.
```

---

### File: .agents/commands/execute-issue.md

```
# Command: execute-issue

Execute the implementation described in the **current branch's** GitHub issue, in two explicit
phases: **Confirmation → Execution**. The issue body is the plan; this command carries it out.
To record the outcome afterwards, run `/ship-note`.

`$ARGUMENTS` is **optional** — extra execution notes or overrides, e.g. `skip confirm`
(auto-approve Phase 1).

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin` output (HTTPS or SSH; GitHub redirects renamed repos, so the slug is always valid).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Resolve the issue (before Phase 1)

Resolve the issue number from the current branch using the precedence in
`.agents/rules/issue-resolution.md`: (1) leading numeric segment, (2) linked PR
`Closes/Fixes/Resolves #N`, (3) title-slug fuzzy match against non-PR issues, (4) ask the user.
A Linear-style token like `sdp-375` is **not** a GitHub issue number. Fetch the issue with
`mcp__github__issue_read` (`method: "get"`) to get its `title` and `body`.

---

## Phase 1 — Confirmation

**Goal:** the user confirms the issue description is correct before any code is written.

1. Show the resolved issue (`#<number> — <title>`), how it was resolved (numeric / linked-PR /
   title-match / user-selected), and the **issue body** (the plan to execute).
2. If the body has an `## Open Questions` section with unresolved items, surface them and ask
   the user to resolve or waive them first.
3. Ask the user to **explicitly confirm** the description is correct and ready to execute.
   - If they want changes → tell them to edit the linked `.agents/plans/` file and re-run `/execute-issue`, then **stop**.
   - If `$ARGUMENTS` contains `skip confirm` (or equivalent), treat Phase 1 as pre-authorized
     but still print the resolved issue + a one-line plan summary before proceeding.
4. Do **not** enter Phase 2 without confirmation.

## Phase 2 — Execution

**Goal:** implement the plan exactly as described in the issue body.

1. **Find the plan source.** Search `.agents/plans/*.md` for a file whose header contains
   `> Issue: #<number>` (where `<number>` is the resolved issue number). If one exists, use
   its **Step-by-Step Implementation** as the primary source of truth and work through it in
   order. If no linked plan exists, fall back to the issue body's Step-by-Step. In either
   case, create/modify/delete the files listed under **Affected Files** in the chosen source.
2. Honor all project conventions: the architecture in `AGENTS.md`, the relevant `.agents/rules/*`
   files (read the matching rule before implementing that kind of feature), and
   `.agents/ubiquitous-language.md` for any domain code.
3. For multi-step work, track progress with the task list (`TaskCreate`/`TaskUpdate`) so the user
   can follow along.
4. Run the issue's **Acceptance Criteria** checks — use the project's acceptance commands from
   `AGENTS.md` › Commands (e.g. `pnpm lint && pnpm build` for Node, or
   `xcodebuild -scheme KeyCount build` for Swift/Xcode). Fix failures introduced by this work.
   Report results **honestly**: if something fails or is skipped, say so with the output.
5. **Do not commit or push** unless the user explicitly asks (follow the global git guidance).
   This command edits the working tree only.
6. When the work is done, point the user to `/ship-note` to record what changed on the issue.

---

## Rules

- Two phases, in order. Never start Phase 2 without Phase 1 confirmation (unless `skip confirm`).
- The linked `.agents/plans/` file (if it exists) is the source of truth for *what* to build;
  fall back to the issue body when no plan is linked. Deviate only with reason and surface
  any deviation so `/ship-note` can record it.
- Execution must obey `AGENTS.md`, the relevant `.agents/rules/*`, and the ubiquitous language.
- Report failures faithfully — never claim done when build/lint failed or a step was skipped.
- Working-tree only: do not commit, push, change issue state/labels, or post to the issue.
- Recording the outcome is a separate step — run `/ship-note` after execution.
```

---

### File: .agents/commands/comment-issue.md

```
# Command: comment-issue

Add a comment to the thread of the GitHub issue that corresponds to the **current branch**.
The comment text comes from `$ARGUMENTS`.

This command only **adds a comment**. It never edits the issue body, title, state, or labels.

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin` output (HTTPS or SSH; GitHub redirects renamed repos, so the slug is always valid).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

1. **Read the comment text** from `$ARGUMENTS`. If empty, ask the user what to comment and stop
   (do not invent a comment).
2. **Parse `owner`/`repo`** from the injected remote URL.
3. **Resolve the issue number from the current branch** using the precedence in
   `.agents/rules/issue-resolution.md`: (1) leading numeric segment, (2) linked PR
   `Closes/Fixes/Resolves #N`, (3) title-slug fuzzy match against non-PR issues, (4) ask the
   user. A Linear-style token like `sdp-375` is **not** a GitHub issue number.
4. **Compose the comment body** from `$ARGUMENTS`:
   - Post the user's text **faithfully** — preserve meaning and wording.
   - Apply only **light Markdown cleanup** (e.g. wrap code in backticks, fix list formatting).
   - Do **not** add content, headers, sign-offs, or a footer the user didn't ask for.
5. **Preview and confirm** — show the resolved issue (`#<number> — <title>`) and the rendered
   comment, then wait for confirmation. A comment is public/outward-facing. Skip confirmation
   only if `$ARGUMENTS` says so (e.g. `no confirm`).
6. **Post the comment** with `mcp__github__add_issue_comment` (`owner`, `repo`, `issue_number`, `body`).
7. **Report** the issue URL (and comment URL if available) to the user.

## Rules

- Resolve the issue from the branch using the precedence above; **confirm before posting**.
- Comment-only — never touch the issue body, title, state, or labels.
- Stay faithful to the user's text; do not editorialize or pad it.
- If the branch resolves to no issue and the user can't name one, stop — never create an issue.
```

---

### File: .agents/commands/ship-note.md

````
# Command: ship-note

Record what actually happened on the GitHub issue that corresponds to the **current branch**,
once an execution (`/execute-issue`) is done. By default the ship-note is posted as a
**new issue comment**.

This command **does not close the issue** and never changes its state, title, or labels — it
only records the outcome. It **always posts** — no confirmation step. `$ARGUMENTS` is
**optional** — overrides such as `post-note in description` (append to the body instead of a comment).

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin` output (HTTPS or SSH).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

1. **Parse `owner`/`repo`** from the injected remote URL.
2. **Resolve the issue number from the current branch** using the precedence in
   `.agents/rules/issue-resolution.md` (numeric segment → linked PR → title-slug → ask). Fetch
   the issue with `mcp__github__issue_read` (`method: "get"`) for its `title` and (only if appending) its current `body`.
3. **Reconcile what actually changed** against reality — run `git status` and `git diff --stat`
   to list the files that were really created/modified/deleted. **Do not** copy the plan's
   Affected Files — report the real diff.
4. **Compose the ship-note** with this structure:

   ```
   ## Ship Note

   **Summary** — what was implemented, in 1–3 sentences.

   **Plan executed** — issue body, or path to the `.agents/plans/` file used.

   **Files changed**
   | Action | File Path | Notes |
   |--------|-----------|-------|
   | CREATE/MODIFY/DELETE | `path/from/root` | what changed |

   **Deviations from the plan** — where execution diverged from the Step-by-Step /
   Affected Files and why. If none, write "None — implemented as planned."

   **Validation** — project acceptance commands ✅/❌ (from `AGENTS.md` › Commands; e.g. `pnpm lint && pnpm build` or `xcodebuild … build`), plus any manual checks.

   **Follow-ups / Open Questions** — anything outstanding or deferred. If none, write "None."

   _Branch: `<current-branch>`. Recorded via `/ship-note`._
   ```

5. **Post the ship-note** — always post immediately; do **not** wait for confirmation.
   - **Default:** a new issue comment via `mcp__github__add_issue_comment`
     (`owner`, `repo`, `issue_number`, `body`).
   - **Override** (`post-note in description` or equivalent): append a `## Ship Note` section
     to the **bottom** of the issue body via `mcp__github__issue_write` (`method: "update"`; preserve the entire
     existing body — append only; send `body` only, never `state`/`title`/`labels`).
6. **Report** to the user: the issue URL, the comment URL (if a comment was posted), and a
   one-line outcome (succeeded / partially / blocked).

## Rules

- Resolve the issue from the branch using `.agents/rules/issue-resolution.md`, then **post immediately — no confirmation**.
- Reconcile the **Files changed** table against the real `git` diff — never just copy the plan.
- Report failures faithfully — if the project acceptance commands failed or a step was skipped, say so.
- **Never close the issue** or change its state, title, or labels. Default to a new comment; only
  append to the description when explicitly asked, and preserve the existing body verbatim.
- Never create a new issue. If the branch resolves to no issue and the user can't name one, stop.
````

---

### File: .agents/commands/update-issue.md

````
# Command: update-issue

Correct the body (and optionally the title) of the GitHub issue that corresponds to the
**current branch**, when the initial generation by `/create-issue` was inaccurate. Writes
to GitHub via `mcp__github__issue_write` (`method: "update"`).

Use this for **correcting generation errors** in the issue — wrong scope, bad file paths,
missing steps. For evolving the implementation plan during execution, edit the linked
`.agents/plans/` file directly instead.

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin` output (HTTPS or SSH).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

When invoked (`$ARGUMENTS` = the corrections to apply):

1. **Read the correction instructions** from `$ARGUMENTS`. If empty, ask the user what to
   correct and stop.
2. **Parse `owner`/`repo`** from the injected remote URL.
3. **Resolve the issue number from the current branch** using the precedence in
   `.agents/rules/issue-resolution.md` (numeric segment → linked PR → title-slug → ask).
   Fetch the issue with `mcp__github__issue_read` (`method: "get"`) to get its `title` and `body`.
4. **Apply the corrections surgically** to the body:
   - Edit only the sections the instructions touch; preserve everything else verbatim.
   - Keep the same section structure that `/create-issue` uses: Goal, Context, Affected
     Files, Step-by-Step Implementation, Architecture Decisions, Acceptance Criteria,
     Open Questions.
   - If the body already has a `## Ship Note` section at the bottom, **preserve it verbatim**
     and re-adjoin it at the bottom after the corrections.
   - If the instructions imply a title change, derive the corrected title (≤ 72 chars,
     Conventional Commits style); otherwise leave the title unchanged.
   - Inspect source files with Read/Bash when the corrections require accurate file paths,
     function signatures, or step details.
5. **Preview and confirm** — show the resolved issue (`#<number> — <title>`), the corrected
   body (and new title if changed), and wait for explicit confirmation before writing.
   Skip confirmation only if `$ARGUMENTS` says so (e.g. `no confirm`).
6. **Write the update** via `mcp__github__issue_write` (`method: "update"`) — always send `body`; send `title`
   only if it changed. Never send `state` or `labels`.
7. **Report** the issue URL to the user.

## Rules

- Resolve the issue from the branch using `.agents/rules/issue-resolution.md`.
- Corrections only — edit surgically, do not rewrite the whole body unless entirely wrong.
- Preserve any `## Ship Note` section at the bottom of the body.
- Preview + confirm before writing (default); `no confirm` skips the wait.
- Never change issue state, labels, or add comments. This command only updates body/title.
- If the branch resolves to no issue and the user can't name one, stop.
````

---

### File: .claude/commands/create-issue.md

```
---
description: Create a GitHub issue with a full implementation plan from a requirement description
argument-hint: [requirement description]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Requirement: $ARGUMENTS

@.agents/commands/create-issue.md
@.agents/rules/plan-creation.md
```

---

### File: .claude/commands/execute-issue.md

```
---
description: Execute the current branch's GitHub issue in two phases — confirm, then implement
argument-hint: [optional execution notes / overrides, e.g. "skip confirm"]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Execution notes / overrides (optional): $ARGUMENTS

@.agents/commands/execute-issue.md
@.agents/rules/issue-resolution.md
@.agents/rules/plan-creation.md
```

---

### File: .claude/commands/comment-issue.md

```
---
description: Add a comment to the thread of the GitHub issue for the current branch
argument-hint: [comment text]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__add_issue_comment
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Comment text: $ARGUMENTS

@.agents/commands/comment-issue.md
@.agents/rules/issue-resolution.md
```

---

### File: .claude/commands/ship-note.md

```
---
description: Post a ship-note of the executed work to the current branch's GitHub issue (does not close it)
argument-hint: [optional overrides, e.g. "post-note in description"]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__add_issue_comment, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Overrides (optional): $ARGUMENTS

@.agents/commands/ship-note.md
@.agents/rules/issue-resolution.md
```

---

### File: .claude/commands/update-issue.md

```
---
description: Correct the body (and optionally the title) of the current branch's GitHub issue
argument-hint: [correction instructions]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Correction instructions: $ARGUMENTS

@.agents/commands/update-issue.md
@.agents/rules/issue-resolution.md
```

---

### File: .opencode/commands/create-issue.md

```
---
description: Create a GitHub issue with a full implementation plan from a requirement description
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Requirement: $ARGUMENTS

@.agents/commands/create-issue.md
@.agents/rules/plan-creation.md
```

---

### File: .opencode/commands/execute-issue.md

```
---
description: Execute the current branch's GitHub issue in two phases — confirm, then implement
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Execution notes / overrides (optional): $ARGUMENTS

@.agents/commands/execute-issue.md
@.agents/rules/issue-resolution.md
@.agents/rules/plan-creation.md
```

---

### File: .opencode/commands/comment-issue.md

```
---
description: Add a comment to the thread of the GitHub issue for the current branch
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Comment text: $ARGUMENTS

@.agents/commands/comment-issue.md
@.agents/rules/issue-resolution.md
```

---

### File: .opencode/commands/ship-note.md

```
---
description: Post a ship-note of the executed work to the current branch's GitHub issue (does not close it)
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Overrides (optional): $ARGUMENTS

@.agents/commands/ship-note.md
@.agents/rules/issue-resolution.md
```

---

### File: .opencode/commands/update-issue.md

```
---
description: Correct the body (and optionally the title) of the current branch's GitHub issue
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Correction instructions: $ARGUMENTS

@.agents/commands/update-issue.md
@.agents/rules/issue-resolution.md
```

---

### File: .agents/scripts/run-github-mcp.sh

```
#!/bin/sh
# Sources project .env and launches the official GitHub MCP server over stdio.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a
# shellcheck disable=SC1091
[ -f "$PROJECT_ROOT/.env" ] && . "$PROJECT_ROOT/.env"
# shellcheck disable=SC1091
[ -f "$PROJECT_ROOT/.env.local" ] && . "$PROJECT_ROOT/.env.local"
set +a

# github-mcp-server reads GITHUB_PERSONAL_ACCESS_TOKEN; map our GITHUB_TOKEN onto it.
export GITHUB_PERSONAL_ACCESS_TOKEN="${GITHUB_TOKEN}"

# GUI-launched agents may start with a minimal PATH; make sure Homebrew bins are found.
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export PATH

# Official GitHub MCP server (github/github-mcp-server), installed via `brew install github-mcp-server`.
exec github-mcp-server stdio
```

---

### File: .mcp.json

```
{
  "mcpServers": {
    "github": {
      "command": "sh",
      "args": [".agents/scripts/run-github-mcp.sh"]
    }
  }
}
```

---

### File: opencode.json

```
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "github": {
      "type": "local",
      "command": ["sh", ".agents/scripts/run-github-mcp.sh"]
    }
  }
}
```

---

### File: .gitignore

```
.env*
.worktrees/
.agents/parallel.config
.claude/settings.local.json
```

---

### File: .agents/rules/parallel-orchestration.md

````
# Rule: Parallel Orchestration — Epic / Child Model

This rule governs `/spec-breakdown`, `/execute-epic`, and `/spec`. It defines the epic/child
data model, branch naming, dependency encoding, wave computation, runner and adapter contracts,
safety caps, and decomposition heuristics.

---

## Epic / Child Model

An **epic** is a normal GitHub issue (resolved by `issue-resolution.md`) whose body
additionally contains a child task-list and a fenced ` ```waves ` graph block.

A **child** is a normal issue in full `/create-issue` house style, prefixed with:

```
> Epic: #<epic>
> Depends on: #<a>, #<b>
```

Omit `> Depends on:` when the child has no dependencies.

### Epic body template

```
## Epic: <title>
<1–2 sentence goal>

### Children
- [ ] #<a> feat: <slice a>
- [ ] #<b> feat: <slice b>

### Dependency graph
```waves
# wave : issues
1 : <a>
2 : <b> <c>
# edges (child -> depends-on)
<b> -> <a>
<c> -> <a>
```
---
*Generated by `/spec-breakdown`. Tracking issue — do not implement here. Run `/execute-epic`.*
```

### Child header (above the standard `/create-issue` sections)

```
> Epic: #<epic>
> Depends on: #<a>, #<b>
```

---

## Branch Naming

- **Children:** `<issue#>-<kebab-title>` (e.g. `12-keystroke-capture`).
  The leading numeric segment is resolved by precedence #1 in `issue-resolution.md`, so
  all issue-aware commands (`/execute-issue`, `/ship-note`, etc.) work on child branches.
- **Epic:** the branch from which `/execute-epic` is run may be `epic/<slug>`.
  Resolved by title-slug fuzzy match (precedence #3 in `issue-resolution.md`).

---

## Dependency Encoding

Two redundant sources so the graph can always be reconstructed:

1. **Epic plan file** (machine-primary): `.agents/plans/[yyyy-mm-dd]-epic-<slug>.md`
   whose header contains `> Issue: #<epic>`, a `Children & Waves` table, and an edge list.
2. **GitHub** (human-readable): each child body carries `> Depends on: #…`; the epic body
   carries the task-list and ` ```waves ` block.

If the plan file is missing, reconstruct the graph from each child's `> Depends on:` lines
by calling `mcp__github__issue_read` (`method: "get"`) per child. If GitHub data is also missing, ask the user.

### Epic plan file template

```markdown
# Plan: Epic — <title>

> Status: **in-progress**
> Created: [YYYY-MM-DD]
> Issue: #<epic>

## Goal
<1–2 sentences>

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #<a> | `<a>-<slug>` | <title> | pending |
| 2 | #<b> | `<b>-<slug>` | <title> | pending |

## Dependency Edges

```
<b> -> <a>
<c> -> <a>
```
```

---

## Wave / Frontier Algorithm

### Computing waves (Kahn leveling)

1. Build a directed graph: nodes = child issue numbers, edges = `child → dependency`.
2. Assign wave = `1 + max(wave of all dependencies)` (nodes with no deps → wave 1).
3. Within a wave, order ascending by issue number.
4. **Cycle guard:** if processing stalls with nodes remaining but no zero-in-degree node,
   stop and report the cycle (list involved issues) — do not proceed.

### Runnable frontier (at execution time)

The frontier = children whose dependencies are **all merged into `main`** AND which are
not yet done:

- **Done / merged:** `mcp__github__list_pull_requests { head:"<owner>:<branch>", state:"all" }`
  returns a PR with `merged_at` set → skip (done).
- **In-progress:** an open PR for that branch exists → skip (already running/waiting).
- **Pending:** no PR found and not merged → include in this run.

---

## Runner Contract

**Input:** one quoted positional arg per child, encoded as `"<issue>:<branch>:<title>"`:

- `<issue>` — numeric GitHub issue number (no spaces).
- `<branch>` — git branch name (no spaces, e.g. `12-keystroke-capture`).
- `<title>` — human title (may contain spaces and `:`); split is on the **first two colons only**.

**Output:**

- Pushes a branch per successful child (commit + push). Never pushes a broken/empty branch.
- Appends `<issue> <branch>` to `.worktrees/.pushed` on success.
- Appends `<issue>` to `.worktrees/.failed` on failure.
- Exit code = number of failures (0 = all succeeded).

**Invoke via the Bash tool:**

```sh
sh .agents/scripts/run-parallel-issues.sh "<issue>:<branch>:<title>" "<issue>:<branch>:<title>" ...
```

---

## Adapter Contract

`$AGENT_EXEC_CMD` is a **command prefix**. The runner appends the issue prompt as the
**final quoted positional argument**. All three CLIs accept a prompt as the last positional
arg in headless mode:

| Agent CLI | `AGENT_EXEC_CMD` |
|-----------|-----------------|
| Claude Code (default, installed) | `claude -p --dangerously-skip-permissions` |
| Codex (not installed on this machine) | `codex exec --full-auto` |
| OpenCode | `opencode run --agent <name>` |

Override in `.agents/parallel.config` (copy from `.agents/parallel.config.example`).

**Security:** `GITHUB_TOKEN` from `.env` is **never** sourced by the runner. Headless agents
have no GitHub access by design — all GitHub API work is done by the orchestrating agent
via MCP in the normal session.

---

## Safety & Cleanup

| Variable | Default | Purpose |
|----------|---------|---------|
| `PARALLEL_MAX_CONCURRENCY` | 3 | Max issues running concurrently |
| `MAX_CHILDREN` | 12 | Hard cap per wave; runner refuses if exceeded |
| `AGENT_TIMEOUT` | 1800 | Per-issue wall-clock cap (seconds); 0 disables |
| `KEEP_WORKTREES` | 0 | 1 = keep worktrees after success (debugging) |
| `WORKTREES_DIR` | `.worktrees` | Gitignored directory for worktree checkouts |

Worktrees are removed on success (unless `KEEP_WORKTREES=1`) and retained on failure so
the agent log can be inspected at `.worktrees/<branch>.log`. Manual cleanup:

```sh
git worktree prune
rm -rf .worktrees/
```

---

## Decomposition Heuristics (for `/spec-breakdown`)

When breaking a spec into 3–8 child slices:

1. **Foundation-first:** isolate a *buildable-skeleton* slice (project/app target, shared
   types, CI scaffold) so all siblings only *add* files. This prevents `*.pbxproj` /
   shared-file merge conflicts across parallel branches.
2. **Shared-artifact dependency:** if two slices write to the same file, the earlier one
   is a dependency of the later.
3. **Data-before-UI:** persistence/model slices before their UI consumers.
4. **Independent behaviors:** each slice implements one complete user-observable behavior
   (vertical slice), not a horizontal layer (e.g. "all view models").

If the spec yields fewer than 3 slices, use `/create-issue` instead.
If it yields more than `MAX_CHILDREN`, ask the user to coarsen before creating issues.

---

## Manual-Merge Checkpoint Model

Children always branch off `main`. `/execute-epic` runs the **current frontier** in
parallel, opens PRs (`Closes #<child>`), posts ship-notes, ticks the epic task-list,
then **stops** and asks you to merge this wave's PRs before the next wave. Re-running
`/execute-epic` is idempotent: it skips done children and computes the new frontier.

### Documented opt-ins (NOT built — describe trade-offs only)

- **`--stacked`:** children in later waves branch off prior-wave branches instead of
  `main`. Enables faster iteration but requires sequential merge order and rebase
  coordination. Built only on explicit request.
- **Auto-merge between waves:** automatically merges each wave before advancing. Reduces
  oversight and can propagate broken changes into later-wave branches. Built only on
  explicit request.
````

---

### File: .agents/scripts/run-parallel-issues.sh

```sh
#!/bin/sh
# run-parallel-issues.sh — execute one "wave" of GitHub issues in parallel.
#
# Each argument is ONE child issue, encoded as:  <issue>:<branch>:<title>
#   <issue>  numeric GitHub issue number (no spaces)
#   <branch> git branch to create          (no spaces, e.g. 12-keystroke-capture)
#   <title>  human title (may contain spaces and ':'), used in commit + prompt
# Split is on the FIRST TWO colons only, so titles may contain ':'.
#
# Per issue: worktree+branch off BASE_BRANCH, run the headless agent ($AGENT_EXEC_CMD)
# to implement the issue by following .agents/commands/execute-issue.md, then (only on
# success) commit + push. No GitHub API here. Config from .agents/parallel.config or env.
# Exit status = number of FAILED issues (0 = all succeeded).

set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT" || { echo "FATAL: cannot cd to project root" >&2; exit 99; }

# ---- defaults (overridable by .agents/parallel.config or the environment) ----
AGENT_EXEC_CMD=${AGENT_EXEC_CMD:-"claude -p --dangerously-skip-permissions"}
PARALLEL_MAX_CONCURRENCY=${PARALLEL_MAX_CONCURRENCY:-3}
MAX_CHILDREN=${MAX_CHILDREN:-12}
WORKTREES_DIR=${WORKTREES_DIR:-.worktrees}
BASE_BRANCH=${BASE_BRANCH:-main}
ACCEPTANCE_CMD=${ACCEPTANCE_CMD:-}        # empty = skip acceptance gate in the runner
KEEP_WORKTREES=${KEEP_WORKTREES:-0}
AGENT_TIMEOUT=${AGENT_TIMEOUT:-1800}      # seconds per issue; 0 disables

# shellcheck disable=SC1091
[ -f "$PROJECT_ROOT/.agents/parallel.config" ] && . "$PROJECT_ROOT/.agents/parallel.config"

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }

if [ "$#" -eq 0 ]; then
  log "usage: $0 <issue:branch:title> [<issue:branch:title> ...]"
  exit 2
fi
if [ "$#" -gt "$MAX_CHILDREN" ]; then
  log "WARNING: wave has $# issues but MAX_CHILDREN=$MAX_CHILDREN; refusing to fan out."
  log "         Re-run with a smaller wave or raise MAX_CHILDREN in .agents/parallel.config."
  exit 3
fi

mkdir -p "$WORKTREES_DIR"

_cli_bin=$(printf '%s\n' "$AGENT_EXEC_CMD" | awk '{print $1}')
if ! command -v "$_cli_bin" >/dev/null 2>&1; then
  log "FATAL: agent CLI '$_cli_bin' not on PATH (AGENT_EXEC_CMD=$AGENT_EXEC_CMD)."
  exit 4
fi

# optional per-issue wall-clock cap, portably (no GNU 'timeout' assumed)
run_with_timeout() {
  _secs=$1; shift
  if [ "$_secs" -le 0 ]; then "$@"; return $?; fi
  "$@" & _cmd_pid=$!
  ( sleep "$_secs"; kill -TERM "$_cmd_pid" 2>/dev/null ) & _killer=$!
  wait "$_cmd_pid"; _rc=$?
  kill -TERM "$_killer" 2>/dev/null
  wait "$_killer" 2>/dev/null
  return "$_rc"
}

process_issue() {
  _issue=$1; _branch=$2; _title=$3
  _wt="$WORKTREES_DIR/$_branch"
  _logf="$WORKTREES_DIR/$_branch.log"

  log "[#$_issue] start -> $_branch (base $BASE_BRANCH)"

  if [ -e "$_wt" ]; then
    git worktree remove --force "$_wt" >/dev/null 2>&1 || rm -rf "$_wt"
  fi
  if git show-ref --verify --quiet "refs/heads/$_branch"; then
    git worktree add "$_wt" "$_branch" >>"$_logf" 2>&1
  else
    git worktree add "$_wt" -b "$_branch" "$BASE_BRANCH" >>"$_logf" 2>&1
  fi
  if [ "$?" -ne 0 ]; then
    log "[#$_issue] FAILED: could not create worktree (see $_logf)"
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  _prompt=$(cat <<EOF
You are a headless coding agent working inside a git worktree for ONE GitHub issue.

Issue: #$_issue — $_title

Follow the procedure in .agents/commands/execute-issue.md (Phase 2 — Execution only;
there is NO human to confirm, treat Phase 1 as pre-approved). Use the linked plan file
in .agents/plans/ whose header contains "> Issue: #$_issue" as the primary source of
truth; if none exists, implement the issue body as described in #$_issue.

Honor AGENTS.md and the relevant .agents/rules/* files. Edit the working tree ONLY.
Do NOT run git commit, git push, or open a pull request — the runner does that.
Do NOT use any GitHub tools. When done, stop. Report what you changed.
EOF
)

  (
    cd "$_wt" || exit 91
    # shellcheck disable=SC2086
    run_with_timeout "$AGENT_TIMEOUT" $AGENT_EXEC_CMD "$_prompt"
  ) >>"$_logf" 2>&1
  _agent_rc=$?

  if [ "$_agent_rc" -ne 0 ]; then
    log "[#$_issue] FAILED: agent exited $_agent_rc (see $_logf). Not pushing."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if [ -z "$(git -C "$_wt" status --porcelain)" ]; then
    log "[#$_issue] FAILED: agent made no changes. Not pushing."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if [ -n "$ACCEPTANCE_CMD" ]; then
    if ! ( cd "$_wt" && sh -c "$ACCEPTANCE_CMD" ) >>"$_logf" 2>&1; then
      log "[#$_issue] FAILED: acceptance '$ACCEPTANCE_CMD' failed (see $_logf). Not pushing."
      echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
    fi
  fi

  git -C "$_wt" add -A >>"$_logf" 2>&1
  git -C "$_wt" commit -m "feat(#$_issue): $_title" \
      -m "Implements #$_issue via /execute-epic parallel runner." \
      -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
      >>"$_logf" 2>&1
  if [ "$?" -ne 0 ]; then
    log "[#$_issue] FAILED: git commit failed (see $_logf)."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi
  if ! git -C "$_wt" push -u origin "$_branch" >>"$_logf" 2>&1; then
    log "[#$_issue] FAILED: git push failed (see $_logf)."
    echo "$_issue" >> "$WORKTREES_DIR/.failed"; return 1
  fi

  log "[#$_issue] OK: pushed $_branch"
  echo "$_issue $_branch" >> "$WORKTREES_DIR/.pushed"
  if [ "$KEEP_WORKTREES" -ne 1 ]; then
    git worktree remove --force "$_wt" >/dev/null 2>&1 || rm -rf "$_wt"
  fi
  return 0
}

# ---- concurrency: job-slot loop, dash-safe (no `wait -n`) ----
: > "$WORKTREES_DIR/.failed"
: > "$WORKTREES_DIR/.pushed"
running_pids=""
running_count=0

drain_one() {
  _oldest=$(printf '%s\n' "$running_pids" | awk '{print $1}')
  [ -n "$_oldest" ] && wait "$_oldest"
  running_pids=$(printf '%s\n' "$running_pids" | cut -d' ' -f2-)
  running_count=$((running_count - 1))
}

for _rec in "$@"; do
  _issue=$(printf '%s' "$_rec" | cut -d: -f1)
  _branch=$(printf '%s' "$_rec" | cut -d: -f2)
  _title=$(printf '%s' "$_rec" | cut -d: -f3-)
  if [ -z "$_issue" ] || [ -z "$_branch" ]; then
    log "skip malformed record: '$_rec'"; continue
  fi
  while [ "$running_count" -ge "$PARALLEL_MAX_CONCURRENCY" ]; do drain_one; done
  process_issue "$_issue" "$_branch" "$_title" &
  running_pids="$running_pids $!"
  running_pids=$(printf '%s' "$running_pids" | sed 's/^ *//')
  running_count=$((running_count + 1))
done
while [ "$running_count" -gt 0 ]; do drain_one; done

failed=$(grep -c . "$WORKTREES_DIR/.failed" 2>/dev/null); failed=${failed:-0}
pushed=$(grep -c . "$WORKTREES_DIR/.pushed" 2>/dev/null); pushed=${pushed:-0}
log "wave complete: $pushed pushed, $failed failed."
[ "$failed" -gt 0 ] && log "failed: $(tr '\n' ' ' < "$WORKTREES_DIR/.failed")"
exit "$failed"
```

---

### File: .agents/parallel.config.example

```
# .agents/parallel.config — operational config for /execute-epic's parallel runner.
# Copy to .agents/parallel.config (gitignored) and edit. The runner sources this file.
# NOT secrets. The GitHub token stays in .env and is never read by the runner.

# Headless agent CLI used to implement each child issue. COMMAND PREFIX: the runner
# appends the issue prompt as the final quoted positional argument.
#   Claude Code : claude -p --dangerously-skip-permissions
#   Codex       : codex exec --full-auto       (note: 'codex' not installed on this box)
#   OpenCode    : opencode run --agent <name>  (agent must be allowed to edit/run)
AGENT_EXEC_CMD="claude -p --dangerously-skip-permissions"

PARALLEL_MAX_CONCURRENCY=3     # issues running at once (each is a full agent process)
MAX_CHILDREN=12                # hard cap per wave; runner refuses beyond this
WORKTREES_DIR=.worktrees       # gitignored
BASE_BRANCH=main               # children cut from main (manual-merge-checkpoint model)

# Optional acceptance gate run inside each worktree before commit+push (empty = skip here).
#   Swift : xcodebuild -scheme KeyCount -destination 'platform=macOS' build
#   Node  : pnpm lint && pnpm build
ACCEPTANCE_CMD=""

KEEP_WORKTREES=0               # 1 = keep worktrees on success (debug)
AGENT_TIMEOUT=1800             # per-issue wall-clock cap (seconds); 0 disables
```

---

### File: .agents/commands/spec-breakdown.md

````
# Command: spec-breakdown

Decompose a large specification into a parent **epic** GitHub issue plus N child issues
(each a full implementation plan), with a dependency graph persisted in an epic plan file.
After this command completes, run `/execute-epic` to execute the children in parallel.

## Context injected by the wrapper

- **Repository remote URL** — parse `owner` and `repo` from the injected
  `git remote get-url origin` output (HTTPS or SSH).
- **Spec** — `$ARGUMENTS` is either a path to a spec file (read it) or the spec text
  directly; if empty, ask the user to provide one.

## Instructions

### 1 — Ingest the spec

If `$ARGUMENTS` is a path that exists in the working tree, read it. Otherwise treat
`$ARGUMENTS` as the spec text itself. If `$ARGUMENTS` is empty, ask the user to
supply a spec file path or description and stop until they do.

### 2 — Parse owner/repo

Extract `owner` and `repo` from the injected remote URL. Supports both HTTPS
(`https://github.com/<owner>/<repo>.git`) and SSH (`git@github.com:<owner>/<repo>.git`).

### 3 — Duplicate guard

Call `mcp__github__list_issues { state:"open", per_page:20 }`. If an issue with a
matching epic title already exists, stop and point the user at `/execute-epic #<n>`.
Do not create a duplicate.

### 4 — Decompose into 3–8 vertical slices

Apply the heuristics in `.agents/rules/parallel-orchestration.md` (Decomposition
Heuristics section):

- **Foundation-first:** isolate a buildable-skeleton slice (project/app target, shared
  types, CI scaffold) as the dependency root so siblings only *add* files.
- **Data-before-UI:** model/persistence slices before their UI consumers.
- **Independent behaviors:** each slice implements one complete user-observable behavior,
  not a horizontal layer.

If the spec yields fewer than 3 slices, tell the user to use `/create-issue` instead.
If it yields more than `MAX_CHILDREN` (default 12), ask the user to coarsen the spec
before proceeding.

Assign a branch name per child: `<placeholder#>-<kebab-title>` (use sequential
placeholder numbers; update to real numbers in step 7).

### 5 — Create the epic issue

Call `mcp__github__issue_write` (`method: "create"`) with `owner`, `repo`, and:

```
title: "epic: <short title>"
body:
  ## Epic: <title>
  <1–2 sentence goal>

  ### Children
  - [ ] #<TBD-a> feat: <slice a>
  - [ ] #<TBD-b> feat: <slice b>

  ### Dependency graph
  ```waves
  # wave : issues
  1 : <TBD-a>
  2 : <TBD-b> <TBD-c>
  # edges (child -> depends-on)
  <TBD-b> -> <TBD-a>
  <TBD-c> -> <TBD-a>
  ```
  ---
  *Generated by `/spec-breakdown`. Tracking issue — do not implement here. Run `/execute-epic`.*
```

Record the created epic issue number as `<epic>`.

### 6 — Create each child issue

For each slice, call `mcp__github__issue_write` (`method: "create"`). The body must follow the full
`/create-issue` house style (Goal, Context, Affected Files, Step-by-Step Implementation,
Architecture Decisions, Acceptance Criteria, Open Questions), with two additional header
lines prepended:

```
> Epic: #<epic>
> Depends on: #<a>, #<b>
```

(Omit `> Depends on:` for the foundation slice or any child with no dependencies.)

**Acceptance Criteria** must use the project's actual acceptance commands from
`AGENTS.md` › Commands (e.g. `xcodebuild -scheme KeyCount build` for a Swift project,
or `pnpm lint && pnpm build` for a Node project). Do **not** hardcode `pnpm` for a
non-Node project.

Record each created child's real issue number and branch name
(`<issue#>-<kebab-title>`).

### 7 — Second pass: update the epic

Call `mcp__github__issue_write` (`method: "update"`) to rewrite the epic body, substituting all `<TBD-*>`
placeholders with the real issue numbers from step 6 (task-list + `waves` block).
Preserve the rest of the body verbatim.

### 8 — Persist the epic plan

Write `.agents/plans/[yyyy-mm-dd]-epic-<slug>.md` using this template:

```markdown
# Plan: Epic — <title>

> Status: **draft**
> Created: [YYYY-MM-DD]
> Issue: #<epic>

## Goal
<1–2 sentences>

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #<a> | `<a>-<slug>` | <title> | pending |
| 2 | #<b> | `<b>-<slug>` | <title> | pending |

## Dependency Edges

```
<b> -> <a>
<c> -> <a>
```
```

### 9 — Report

Respond with:
- Epic issue URL and number
- Each child issue URL, number, branch, and assigned wave
- The computed waves table
- A reminder to run `/execute-epic` (or `/spec` if this was called stand-alone)

## Rules

- Follow `parallel-orchestration.md` for all decomposition and naming decisions.
- Follow `plan-creation.md` for the epic plan file format.
- Never create a duplicate — check open issues first (step 3).
- Use project-derived acceptance commands in child issues, not hardcoded `pnpm`.
- If fewer than 3 slices result, stop and recommend `/create-issue` instead.
````

---

### File: .agents/commands/execute-epic.md

````
# Command: execute-epic

Execute the children of a GitHub **epic** issue in parallel — one wave (frontier) per
run — then open PRs, post ship-notes, tick the epic task-list, and stop for a manual
merge checkpoint before the next wave. Re-running is idempotent.

`$ARGUMENTS` is **optional**: `skip confirm` (skip step 6) or `dry-run` (stop after
step 6, printing the plan but not running the runner).

## Context injected by the wrapper

- **Repository remote URL** — parse `owner`/`repo` from the injected
  `git remote get-url origin` output (HTTPS or SSH).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

### 1 — Parse owner/repo and current branch

Extract `owner` and `repo` from the injected remote URL. Note the current branch.

### 2 — Resolve the epic

Use the precedence in `.agents/rules/issue-resolution.md` to identify the epic issue
from the current branch (numeric segment, linked PR, title-slug, or ask). Fetch it
with `mcp__github__issue_read` (`method: "get"`) to get `title` and `body`.

### 3 — Find the epic plan

Search `.agents/plans/*.md` for a file whose header contains `> Issue: #<epic>`. If
found, use its `Children & Waves` table and edge list as the primary source of truth.

If no plan file exists, reconstruct the graph from GitHub:
1. Parse the epic body's child task-list for child issue numbers.
2. For each child, call `mcp__github__issue_read` (`method: "get"`) and extract the `> Depends on:` header.
3. Build the edge list from those dependencies.

If neither source yields a graph, ask the user to run `/spec-breakdown` first.

### 4 — Compute waves

Apply Kahn leveling from `.agents/rules/parallel-orchestration.md` (Wave / Frontier
Algorithm section): assign each child to a wave, ascending by issue number within each
wave. Apply the cycle guard; stop and report if a cycle is detected.

Display the full wave plan to the user.

### 5 — Determine the runnable frontier

For each child, check its status via
`mcp__github__list_pull_requests { head:"<owner>:<branch>", state:"all" }`:

- **Merged PR** (`merged_at` set) → done; skip.
- **Open PR** → in-progress; skip (already running/waiting).
- **No PR** and no merged branch → pending.

The frontier = pending children whose **all** dependencies have merged PRs.

If the frontier is empty and no pending children remain, the epic is complete → post
the final summary comment (see step 9) and stop.

If the frontier is empty but pending children remain (their deps are not yet merged),
tell the user which children are blocked and what needs to be merged first, then stop.

### 6 — Confirm

Unless `$ARGUMENTS` contains `skip confirm`, print and wait for explicit confirmation:

- Epic title and number
- Full wave plan (all waves, marking done/in-progress/pending per child)
- The frontier about to run (child number, branch, title)
- The `AGENT_EXEC_CMD` that will be used
- Concurrency cap (`PARALLEL_MAX_CONCURRENCY`)
- Any warnings (CLI not on PATH, children > `MAX_CHILDREN`, etc.)

If `$ARGUMENTS` contains `dry-run`, stop here after printing the plan.

### 7 — Run the frontier

Use the Bash tool to invoke the runner with one quoted arg per frontier child:

```sh
sh .agents/scripts/run-parallel-issues.sh "<issue>:<branch>:<title>" "<issue>:<branch>:<title>" ...
```

Wait for the runner to complete. Its exit code = number of failures.

### 8 — Process results

Read `.worktrees/.pushed` (successful children) and `.worktrees/.failed` (failed).

**For each pushed child:**
1. Open a PR:
   `mcp__github__create_pull_request { owner, repo, head:"<branch>", base:"main",
   title:"<child title>", body:"Closes #<child>\n\nPart of epic #<epic>.\n\n<1–2 sentence summary>" }`
2. Post a ship-note comment to the child issue:
   `mcp__github__add_issue_comment` — mirror `/ship-note` structure (Summary, Files
   changed from the worktree log, Validation results, branch/PR reference).
3. Tick the epic task-list item for this child:
   `mcp__github__issue_write` (`method: "update"`) — change `- [ ] #<child>` to `- [x] #<child>` in
   the epic body. Preserve the rest of the body verbatim.

**For each failed child:**
1. Do not open a PR.
2. Post a failure comment to the child issue:
   `mcp__github__add_issue_comment` — note the failure, agent exit code, and that
   the worktree log is retained at `.worktrees/<branch>.log` for inspection.

### 9 — Merge checkpoint or final summary

**If later waves remain pending:**

Post a comment on the epic issue listing:
- This wave's PRs (child → PR URL)
- What to do next: merge this wave's PRs into `main`, then re-run `/execute-epic`
  to advance to the next wave

Then tell the user the same message in-session and stop.

**If no pending children remain (all done or this was the last wave):**

Post a final summary comment on the epic (`mcp__github__add_issue_comment`):

```
## Epic Complete

All child issues have been implemented and PRs opened.

| Child | Branch | PR | Status |
|-------|--------|----|--------|
| #<a> | `<branch>` | <PR URL> | merged / open |

Recommended merge order follows the wave plan above.
```

## Rules

- Follow `issue-resolution.md` to identify the epic from the current branch.
- Follow `parallel-orchestration.md` for wave computation, frontier detection, and
  runner invocation.
- Re-running is idempotent — skip done/in-progress children; only run the frontier.
- Never push or commit directly; the runner handles that.
- `dry-run` stops after printing the plan (step 6); no runner call, no GitHub writes.
- Two-wave runs require a manual merge checkpoint between waves (always stop and instruct
  the user to merge before advancing).
````

---

### File: .agents/commands/spec.md

```
# Command: spec

One-shot pipeline: decompose a large spec into an epic + child issues, pause for
human review, then execute the first wave in parallel. This command **chains**
`/spec-breakdown` and `/execute-epic`; it does not duplicate their logic.

`$ARGUMENTS` — spec text or path to a spec file (passed through to `/spec-breakdown`).

## Context injected by the wrapper

- **Repository remote URL** — from `git remote get-url origin`
- **Current branch** — from `git rev-parse --abbrev-ref HEAD`

## Instructions

### Phase 1 — Breakdown

Follow `.agents/commands/spec-breakdown.md` exactly, passing `$ARGUMENTS` as the
spec input. Complete all nine steps (ingest → decompose → create epic → create
children → update epic → persist plan → report).

### Phase 2 — Review pause

Present the created epic URL, all child issue URLs and branches, and the computed
waves. Then **stop and ask the user** to confirm the decomposition before proceeding.

The user may:
- **Approve** → proceed to Phase 3.
- **Request changes** → edit the epic/child issues or re-run `/spec-breakdown` with a
  revised spec; do not proceed.
- **Cancel** → stop.

Do not auto-proceed. A pause here is mandatory.

### Phase 3 — Execute

Once the user approves, follow `.agents/commands/execute-epic.md` on the epic just
created. The `skip confirm` flag is implicit (the review pause in Phase 2 served that
purpose); do not ask for another confirmation.

Execute through step 9 of `execute-epic.md`. Stop at the merge checkpoint as
`execute-epic.md` prescribes.

## Rules

- Phases 1 and 3 delegate entirely to their canonical specs; do not duplicate logic.
- The pause in Phase 2 is mandatory — never auto-proceed to execution.
- If Phase 1 fails (fewer than 3 slices, duplicate epic, etc.), stop and report;
  do not attempt Phase 3.
```

---

### File: .claude/commands/spec-breakdown.md

```
---
description: Decompose a large spec into an epic issue + N child issues with a dependency graph
argument-hint: [spec text pasted inline, OR a path to a spec file you attach, e.g. ./spec.md]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Spec (text or file path): $ARGUMENTS

@.agents/commands/spec-breakdown.md
@.agents/rules/parallel-orchestration.md
@.agents/rules/plan-creation.md
```

---

### File: .claude/commands/execute-epic.md

```
---
description: Execute an epic's child issues in parallel (one wave/frontier per run), then open PRs
argument-hint: [optional: "skip confirm" | "dry-run"]
allowed-tools: Bash(git:*), Bash(sh .agents/scripts/run-parallel-issues.sh:*), mcp__github__issue_read, mcp__github__list_issues, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__add_issue_comment, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Options (optional): $ARGUMENTS

@.agents/commands/execute-epic.md
@.agents/rules/issue-resolution.md
@.agents/rules/parallel-orchestration.md
```

---

### File: .claude/commands/spec.md

```
---
description: One-shot — break a spec into an epic + children, then execute them in parallel
argument-hint: [spec text OR path to a spec file]
allowed-tools: Bash(git:*), Bash(sh .agents/scripts/run-parallel-issues.sh:*), mcp__github__list_issues, mcp__github__issue_write, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__add_issue_comment
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Spec (text or file path): $ARGUMENTS

@.agents/commands/spec.md
@.agents/rules/parallel-orchestration.md
@.agents/rules/plan-creation.md
@.agents/rules/issue-resolution.md
```

---

### File: .opencode/commands/spec-breakdown.md

```
---
description: Decompose a large spec into an epic issue + N child issues with a dependency graph
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Spec (text or file path): $ARGUMENTS

@.agents/commands/spec-breakdown.md
@.agents/rules/parallel-orchestration.md
@.agents/rules/plan-creation.md
```

---

### File: .opencode/commands/execute-epic.md

```
---
description: Execute an epic's child issues in parallel (one wave/frontier per run), then open PRs
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Options (optional): $ARGUMENTS

@.agents/commands/execute-epic.md
@.agents/rules/issue-resolution.md
@.agents/rules/parallel-orchestration.md
```

---

### File: .opencode/commands/spec.md

```
---
description: One-shot — break a spec into an epic + children, then execute them in parallel
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Spec (text or file path): $ARGUMENTS

@.agents/commands/spec.md
@.agents/rules/parallel-orchestration.md
@.agents/rules/plan-creation.md
@.agents/rules/issue-resolution.md
```
