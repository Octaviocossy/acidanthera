# AGENTS.md

## Design Interrogation
- Before planning anything whose design is not already settled, run `/grill`. Full protocol in
  `.agents/rules/design-interrogation.md`.
- It models the work as a **design tree** and asks the whole **frontier** — every decision whose
  prerequisites are settled — in one numbered round, each question carrying a recommended
  answer, then stops and waits. Facts are the agent's job (dispatch sub-agents); decisions are
  the user's. Done when the frontier is empty.
- Terminology is sharpened **during** the session against `.agents/ubiquitous-language.md` — see
  the Active mode section of `.agents/rules/domain-glossary.md`.
- Output: a settled **design spec** at `.agents/specs/[yyyy-mm-dd]-[short-kebab-description].md`,
  plus any ADRs raised in `.agents/adr/` (`.agents/rules/adr.md`).
- The spec then routes to `/planning` (local), `/create-issue` (one issue), or
  `/spec-breakdown <spec path>` (3–8 slices). `/spec-breakdown` already accepts a spec file path,
  so no special handoff is needed.
- Never run a design interrogation inside a headless parallel-runner child — there is no human
  to answer.

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
- Decisions that outlive the task that produced them belong in an ADR under `.agents/adr/`, not in
  the glossary or a plan file. Format and the three-part offer test are in `.agents/rules/adr.md`.

## Testing
- Frontend test runner: Vitest, configured in `vite.config.ts` (`test` block) — no separate `vitest.config.ts`.
- Backend test runner: Cargo, with Rust unit tests co-located in `src-tauri/src/**` modules.
- Full conventions (what to test, file placement, harness usage) are in `.agents/rules/testing.md`. Read it before writing or reviewing tests.

## Workspace
- Package manager: pnpm @ 10 (unpinned — no `packageManager` field in `package.json`)
- Node: >=18 (required by Vite 7 / React 19; declared in `package.json` `engines`)
- Monorepo: no — single-package
- Apps: Tauri 2 desktop app (React 19 + Vite 7 frontend in `src/`, Rust backend in `src-tauri/`)
- Packages: none

## Commands
- Dev: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Type check: `pnpm build` (the only `tsc` invocation is inside `build`)
- Test (frontend): `pnpm test` (Vitest, run once; `pnpm test:watch` for watch mode, `pnpm coverage` for a v8 coverage report)
- Test (Rust): `pnpm test:rust`
- Format: `pnpm format`
- Check (lint+format): `pnpm check`

## Verification Quirks
_None documented yet._

## Skills
- A **skill** is a procedure the agent loads on its own when the situation matches its
  `description` — as opposed to a slash command, which the user starts. Full conventions in
  `.agents/rules/skill-creation.md`.
- Canonical body: `.agents/skills/<name>/SKILL.md`, surfaced to Claude Code by a relative
  symlink at `.claude/skills/<name>`. OpenCode reads `.agents/skills/` natively; Claude Code
  reads only `.claude/skills/` — hence the symlink. Reasoning in
  `.agents/adr/0001-skills-canonical-in-agents-skills.md`.
- App-specific skills: `apps/<app>/.agents/skills/`
- Package-specific skills: `packages/<pkg>/.agents/skills/`
- Prefer the narrowest ownership boundary that still matches real usage.
- Vendored bodies carry no attribution footer; divergences from upstream live in
  `.agents/adr/0019-vendored-artifacts-carry-no-attribution.md`.
- Available: `resolving-merge-conflicts` — fires on an in-progress git merge/rebase conflict.
  Finds the intent behind each side, resolves every hunk without inventing behavior, runs the
  project's checks, and finishes the merge.
- Available: `standards-and-spec-review` — fires when a branch needs checking on two axes:
  **Standards** (does it follow `AGENTS.md`, `.agents/rules/`, the glossary, and the ADRs?) and
  **Spec** (does it implement the issue/plan/spec it came from?). Runs the axes as parallel
  sub-agents and reports them side by side without reranking. Deduces the fixed point from the
  branch (epic branch for a child, else `main`). Not a correctness-bug hunt — that is
  `/code-review`.
- Available: `rust-best-practices` — fires when writing, reviewing, or refactoring Rust in
  `src-tauri/`: ownership and borrowing choices, `Result` error handling, performance. Based on
  Apollo GraphQL's handbook.
- Available: `tauri-v2` — fires on Tauri v2 work: `tauri.conf.json`, `#[tauri::command]`, IPC
  (`invoke`, `emit`, channels), capabilities/permissions, build and distribution.
- Available: `vercel-composition-patterns` — fires on React component-architecture work:
  boolean-prop proliferation, compound components, context providers, React 19 API changes.
- Available: `orbit-design` — fires when writing or reviewing UI in `src/components` or
  `src/styles`, enforcing the Orbit surface, typography, radius, accent, and iconography rules.

## Slash Commands
- Cross-agent slash commands (Claude Code + OpenCode) follow `.agents/rules/command-creation.md`.
- Canonical specs live in `.agents/commands/<name>.md`; thin wrappers in `.claude/commands/` and `.opencode/commands/` reference them with identical bodies (only frontmatter differs).
- Invoke in either agent with `/<name>`.
- Available: `commit-message` — generate a Conventional-Commits message from the current diff.
- Available: `grill` — relentless design interrogation; writes a settled spec to `.agents/specs/`, sharpens the glossary inline, and raises ADRs. Run it before `/planning`, `/create-issue`, or `/spec-breakdown` when the design is not yet settled.
- Available: `planning` — create a thorough implementation plan and persist it in `.agents/plans/`.
- Available: `install-scaffold` — install the cross-agent governance scaffold into a target project directory; never overwrites, safe to re-run.
- Available: `create-issue` — create a GitHub issue with a full implementation plan from a requirement description.
- Available: `update-issue` — correct the body (and optionally the title) of the current branch's GitHub issue when the initial generation was inaccurate.
- Available: `execute-issue` — execute the current branch's GitHub issue in two phases (confirm, implement); uses the linked `.agents/plans/` file as primary plan source if one exists.
- Available: `comment-issue` — add a comment to the thread of the GitHub issue for the current branch.
- Available: `ship-note` — post a ship-note of the executed work to the current branch's issue (does not close it).
- Available: `spec-breakdown` — decompose a large spec into an epic issue + N child issues with a dependency graph.
- Available: `execute-epic` — execute an epic's child issues wave-by-wave: each one is pushed, passed through an agentic review, reworked automatically on a hard violation, then integrated into the epic branch; nobody is asked anything. Opens one epic PR at completion.
- Available: `supervise-epic` — the same staged pipeline as `execute-epic`, plus a human approve/reject decision per child at the review gate before it can integrate. User-invocable only — there is no headless equivalent.
- Available: `spec` — one-shot: break a spec into an epic + children, then execute them; `--supervised` at the call site routes execution through `/supervise-epic` instead of the `/execute-epic` default.
- Available: `handoff` — hand this conversation off to a fresh background agent (`claude --bg`) seeded with a summary as its prompt; one detached continuation in this working tree, sandboxed from GitHub unless `with-github`. Claude Code only — OpenCode has no background mode and prints the summary instead.

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
block, backed by a real, long-lived **epic integration branch** `epic/<epic#>-<slug>`. Each
*child* is a full-plan issue with `> Epic: #<n>` and `> Depends on: #…` headers. Children use
branch names `<issue#>-<kebab-title>` and branch off the epic branch, not `main` directly.

**Setup (one-time):**
1. Copy `.agents/parallel.config.example` → `.agents/parallel.config` (gitignored).
2. Set `AGENT_EXEC_CMD` (default: `claude -p --dangerously-skip-permissions`).
3. Ensure `Build:` and `Test:` in `## Commands` above are filled in — child agents read them.

**Runner:** `.agents/scripts/run-parallel-issues.sh` — one worktree + headless agent per child,
concurrent up to `PARALLEL_MAX_CONCURRENCY` (default 3). A plain run only commits and pushes each
child; it never integrates. Given `--epic <branch>`, three further action flags drive a child
through the rest of the pipeline: `--review` (fans out an agentic `standards-and-spec-review` per
child), `--rework` (re-dispatches a rejected child with feedback), and `--integrate` (the only
action that merges into the epic branch). The orchestrating agent only reads epic-branch state
and opens the final PR via MCP — the runner is the epic branch's sole writer throughout.
`GITHUB_TOKEN` is never sourced by the runner — headless agents have no GitHub access by design.

**The review gate:** every child passes an agentic review before it can integrate, on both
execution paths. `/execute-epic` (auto) resolves it alone — a hard violation blocks integration
and triggers automatic rework, a judgement call never blocks; nobody is asked anything.
`/supervise-epic` runs the identical pipeline plus a human approve/reject decision per child,
informed by the diff, the agent log, and the same agentic report; a hard violation pre-selects
"reject" but the human has the final say. `/spec` defaults to the auto path; pass `--supervised`
at the call site to route it through `/supervise-epic` instead. The runner pre-builds a
**corpus pack** (`.worktrees/.corpus-pack.md`) once per `--review` invocation so the
standards sources are read once rather than once per context, and the caller pre-writes
`.worktrees/.epic-issue.md` so the Spec axis sees the epic's scope headless. Full contract
(the runner's action flags, the rework loop, `REVIEW_AGENT_EXEC_CMD`, `MAX_REWORK_ROUNDS`)
in `.agents/rules/parallel-orchestration.md`.

**Wave flow:** either command creates an epic integration branch `epic/<epic#>-<slug>` and runs
each runnable wave through the full pipeline — push → review → optional rework → integrate — in
one invocation; waves advance with no manual merge step. Each integrated child issue is
**closed** and its branch **deleted** (opt out with `KEEP_CHILD_BRANCHES=1`). At completion it
opens a single `epic → main` PR. Re-running is idempotent (done children are detected from the
epic branch).

**Safety caps:** `MAX_CHILDREN=12`, `AGENT_TIMEOUT=1800s`, `PARALLEL_MAX_CONCURRENCY=3`,
`MAX_REWORK_ROUNDS=2`, `KEEP_CHILD_BRANCHES=0`. Override in `.agents/parallel.config`.

## Code Structure
<!-- TODO: document the framework, router style, key directories, and any import conventions -->
_None documented yet._
