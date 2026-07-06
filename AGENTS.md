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
- Package manager: pnpm @ 10 (unpinned — no `packageManager` field in `package.json`)
- Node: >=18 (required by Vite 7 / React 19; no `engines` field pinned)
- Monorepo: no — single-package
- Apps: Tauri 2 desktop app (React 19 + Vite 7 frontend in `src/`, Rust backend in `src-tauri/`)
- Packages: none

## Commands
- Dev: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Type check: `pnpm build` (the only `tsc` invocation is inside `build`)
- Test: _none configured yet — no test runner installed_
- Format: `pnpm format`
- Check (lint+format): `pnpm check`

## Verification Quirks
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
