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
