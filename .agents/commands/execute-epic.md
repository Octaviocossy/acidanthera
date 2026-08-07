# Command: execute-epic

Execute the children of a GitHub **epic** issue against a dedicated **epic integration
branch** — the runner auto-merges each successful child into it, so waves advance with
no manual merge step. Runs every runnable wave to completion in one invocation, then
opens a **single `epic → main` pull request**. Re-running is idempotent.

`$ARGUMENTS` is **optional**: `skip confirm` (skip step 7) or `dry-run` (stop after
step 7, printing the plan but not running the runner).

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
found, use its `Children & Waves` table and edge list as the primary source of truth
(and its `> Integration branch:` header line, if present, per Step 5 below).

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

### 5 — Derive the integration branch

Compute `EPIC_BRANCH = epic/<epic#>-<kebab-slug-of-epic-title>` (strip a leading
`epic:` from the title; kebab-case the rest; keep it under ~50 chars). This is derived
from the **epic issue**, independent of the branch the user invoked from. State it
explicitly in the plan display. If the epic plan file has a `> Integration branch:`
header, prefer that value (it was fixed at `/spec-breakdown` time).

### 6 — Determine per-child status against the epic branch

For each child, classify:

- **done** — the epic branch already contains its merge. Detect via
  `mcp__github__list_commits { owner, repo, sha: "<EPIC_BRANCH>", per_page: 100 }` and
  match a commit whose message contains `Merge child #<child>`. If the call 404s (the
  epic branch does not exist yet), treat **all** children as not-done.
- **failed/conflict (this session)** — appears in `.worktrees/.mergefail` or
  `.worktrees/.failed` after a run (used during the wave loop, step 8).
- **pending** — otherwise.

If every child is already done, skip to step 9 (open/verify the epic PR).

### 7 — Confirm

Unless `$ARGUMENTS` contains `skip confirm`, print and wait for explicit confirmation:

- Epic title and number
- The **integration branch** name (`EPIC_BRANCH`)
- Full wave plan (all waves, marking done/pending per child)
- The `AGENT_EXEC_CMD` that will be used
- Concurrency cap (`PARALLEL_MAX_CONCURRENCY`)
- Any warnings (CLI not on PATH, children > `MAX_CHILDREN`, etc.)

If `$ARGUMENTS` contains `dry-run`, stop here after printing the plan.

### 8 — Wave loop (auto-advance)

Repeat until no progress:

1. Compute the **frontier** = pending children whose **every** dependency is **done**
   (merged into the epic branch).
2. If the frontier is empty **and** pending children remain, their dependencies failed
   or conflicted → report which children are blocked and why, then break the loop.
3. If the frontier is empty **and** no pending children remain → the epic is fully
   integrated → go to step 9.
4. **Fetch and stage each frontier child's issue body** — the runner has no GitHub
   access. For every child in this frontier, call `mcp__github__issue_read`
   (`method: "get"`) and write its raw `body` to `.worktrees/.bodies/<issue>.md`
   (`mkdir -p .worktrees/.bodies` first). Do this for **every** wave, not just the
   first — skipping it leaves the headless agent guessing scope from the title alone.
5. Invoke the runner **once** for the frontier, passing `--epic`:
   ```sh
   sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> \
     "<issue>:<branch>:<title>" "<issue>:<branch>:<title>" ...
   ```
   Wait for it to finish.
6. Read `.worktrees/.merged` (integrated), `.worktrees/.mergefail` (conflict — branch
   pushed but not integrated), `.worktrees/.failed` (agent/worktree failure).
7. **For each merged child:** post a ship-note comment to the child issue
   (`mcp__github__add_issue_comment`, mirroring `/ship-note`: Summary, Files changed
   from `.worktrees/<branch>.log`, Validation, and the `#<child> → <EPIC_BRANCH>`
   integration reference); **close the child issue** (`mcp__github__issue_write`,
   `method: "update"`, `state: "closed"`, `state_reason: "completed"`) — the runner has
   already deleted its branch; then tick the epic task-list item
   (`mcp__github__issue_write`, `method: "update"`, `- [ ] #<child>` → `- [x] #<child>`,
   preserving the rest of the body). Mark the child **done** in local state.
8. **For each mergefail/failed child:** post a failure comment
   (`mcp__github__add_issue_comment`) noting the cause (agent exit, or a merge conflict
   with `<EPIC_BRANCH>`) and that `.worktrees/<branch>.log` is retained. **Do not** tick
   the task-list. Its dependents stay blocked.
9. **For each `.mergefail` child, offer guided recovery.** The runner retains the child's
   worktree at `.worktrees/<branch>/` and its log. Ask the user whether to resolve now.
   On yes: `git -C .worktrees/<branch> fetch origin <EPIC_BRANCH>` then
   `git -C .worktrees/<branch> merge origin/<EPIC_BRANCH>` — this reproduces the same
   conflict in the **child's** direction, where resolving it is safe. The
   `resolving-merge-conflicts` skill takes over from there. Present the resolved diff for
   review before pushing the child branch, then re-run `/execute-epic` so the runner
   integrates it. **Never** push to `<EPIC_BRANCH>`. On no, leave the child blocked.
10. If this iteration merged **zero** children, break (no-progress guard) to avoid
    looping forever. Bound the loop to at most the number of waves.

### 9 — Open the single epic PR and post the final summary

- **Reconcile done children (self-heal).** For every child classified **done**, make sure
  its GitHub issue is closed: fetch the still-open set once with
  `mcp__github__list_issues { owner, repo, state:"open" }` and, for any done child still in
  it, `mcp__github__issue_write` (`method:"update"`, `state:"closed"`,
  `state_reason:"completed"`). This catches children merged in a prior/interrupted run or
  before per-child closing existed. **Do not** touch child branches here — branch lifecycle
  is the runner's (it honors `KEEP_CHILD_BRANCHES`). **Never** close the **epic** issue —
  it closes when the `epic → main` PR merges.
- If **all** children are done: ensure a PR exists for the epic branch —
  `mcp__github__list_pull_requests { head:"<owner>:<EPIC_BRANCH>", state:"all" }`; if
  none, `mcp__github__create_pull_request { owner, repo, head:"<EPIC_BRANCH>",
  base:"main", title:"<epic title>", body:"Closes #<epic>\n\nIntegrates all child
  issues:\n<child table>" }`.
- Post a final summary comment on the epic (`mcp__github__add_issue_comment`) with the
  child → status table and the epic PR URL.
- If some children failed/conflicted: **do not** open the epic PR; report the blocked
  set and stop (re-running `/execute-epic` after the human fixes the conflict is
  idempotent — already-merged children are detected as done in step 6).

## Rules

- Follow `issue-resolution.md` to identify the epic from the current branch.
- Follow `parallel-orchestration.md` for wave computation, the epic integration branch,
  and the runner invocation.
- The runner integrates each child into the epic branch; the agent never merges — it
  only reads epic-branch state via `mcp__github__list_commits` and opens the final PR.
- Waves auto-advance in a single run: the wave loop keeps invoking the runner on the
  newly-runnable frontier until the epic is complete or blocked.
- Re-running is idempotent — done children are detected from the epic branch; only
  pending children in the current frontier run.
- Never push or commit directly; the runner handles that.
- The agent never writes to the epic branch. A merge conflict is resolved in the **child
  branch's** direction (merge `<EPIC_BRANCH>` into the child, per the
  `resolving-merge-conflicts` skill) and re-integrated by the runner on the next run — the
  runner stays the epic branch's single writer.
- `dry-run` stops after printing the plan (step 7); no runner call, no GitHub writes.
- One `epic → main` PR at completion — no per-child PRs. Per-child traceability comes
  from ship-note comments and epic task-list ticking.
- On clean integration each child is **closed** (agent, `issue_write` → `state:"closed"`,
  `state_reason:"completed"`) and its **branch deleted** (runner, unless
  `KEEP_CHILD_BRANCHES=1`). The **epic** issue and the **epic branch** are never
  closed/deleted by this flow — the epic closes via the `epic → main` PR's `Closes #<epic>`.
