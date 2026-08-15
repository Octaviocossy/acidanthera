# Command: execute-epic

Execute the children of a GitHub **epic** issue against a dedicated **epic integration
branch**. Each child runs the full staged pipeline — push, agentic review, automatic
rework on a hard violation, integrate — with nobody watching: a hard violation blocks
integration and triggers rework instead of a prompt; a judgement call never blocks.
Waves still advance with no manual merge step. Runs every runnable wave to completion
in one invocation, then opens a **single `epic → main` pull request**. Re-running is
idempotent.

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
- That each child now runs push → agentic review → automatic rework on a hard violation
  → integrate before it lands on `EPIC_BRANCH` (the review gate — no prompt on this path)
- The `AGENT_EXEC_CMD` that will implement each child and the `REVIEW_AGENT_EXEC_CMD`
  that will review it (inherits `AGENT_EXEC_CMD` when unset)
- Concurrency cap (`PARALLEL_MAX_CONCURRENCY`) and the rework cap (`MAX_REWORK_ROUNDS`)
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
4. **Push stage.** For each child in the frontier, write its issue body to
   `.worktrees/<branch>.issue.md` — fetch with `mcp__github__issue_read`
   (`method: "get"`). The implementing agent dispatched next has no GitHub access by
   design (Adapter Contract); without this file it falls back to "implement the issue
   body as described in #<child>", which it cannot do. The reviewer dispatched later
   reads the same file for its Spec axis. Also write the epic issue's body (already
   fetched in step 2) once per session to `.worktrees/.epic-issue.md` — shared by every
   child. The reviewer passes it to the Spec axis for the child's intended scope;
   without it, the skill's "read the epic issue" instruction is a silent no-op headless
   (no GitHub access by design). Then invoke the runner once for the frontier,
   no action flag (a plain run — it pushes each child and does not integrate):
   ```sh
   sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> \
     "<issue>:<branch>:<title>" "<issue>:<branch>:<title>" ...
   ```
   Read `.worktrees/.pushed` (ready for review) and `.worktrees/.failed` (agent/
   worktree/push failure — blocked immediately; rework is for a rejected review, not a
   run that never produced a working push).
5. **Review → decide → rework cycle**, over the children in `.worktrees/.pushed`.
   Repeat the three steps below until every one of them is either **approved** or
   **blocked**:
   1. **Review stage** — one `--review` call for every still-unresolved child:
      ```sh
      sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> --review \
        "<issue>:<branch>:<title>" ...
      ```
      Writes `.worktrees/<branch>.review.md` (the agentic Standards + Spec report) per
      child; reads the `.worktrees/<branch>.issue.md` already written in the push stage
      above.
   2. **Decide** — read each child's `.review.md`. Any finding explicitly marked a
      **hard violation** (Standards or Spec axis) → **reject** it. Otherwise (judgement
      calls only, or no findings) → **approve** it. This is the whole authority the
      auto path has — judgement calls never block (`parallel-orchestration.md` › The
      Review Gate; `.agents/ubiquitous-language.md` › Branch review).
   3. **Rework stage** — for every rejected child, write `.worktrees/<branch>.feedback`
      with the full review report (no human text on this path — there is nobody to add
      any) and call:
      ```sh
      sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> --rework \
        "<issue>:<branch>:<title>" ...
      ```
      A child with rounds left under `MAX_REWORK_ROUNDS` gets a new
      `rework(#<child>): ronda <n>` commit and goes back to the review stage above for
      **re-review** — a rework can break something the previous round passed. A child
      whose rework attempt itself fails, or that already exhausted its rounds, lands in
      `.worktrees/.failed` and is **blocked** exactly like a mergefail; drop it from the
      unresolved set. The runner counts rounds from git (`rework(#N): ronda K` commits
      already on the branch), so this cycle is bounded without any state kept here.
6. **Integrate stage.** For every approved child:
   ```sh
   sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> --integrate \
     "<issue>:<branch>:<title>" ...
   ```
   Read `.worktrees/.merged` (integrated) and `.worktrees/.mergefail` (conflict —
   branch pushed but not integrated).
7. **For each merged child:** post a ship-note comment to the child issue
   (`mcp__github__add_issue_comment`, mirroring `/ship-note`: Summary, Files changed
   from `.worktrees/<branch>.log`, Validation, and the `#<child> → <EPIC_BRANCH>`
   integration reference) **plus** how many rework rounds ran and, if any ran, the last
   hard-violation reason — count rounds with `git fetch origin <EPIC_BRANCH>` then
   `git log origin/<EPIC_BRANCH> --grep "^rework(#<child>): ronda" --oneline`, and quote
   the reason from `.worktrees/<branch>.review.md` (no comment is posted per rejection;
   this ship-note is the only trace). **Close the child issue**
   (`mcp__github__issue_write`, `method: "update"`, `state: "closed"`,
   `state_reason: "completed"`) — the runner has already deleted its branch; then tick
   the epic task-list item (`mcp__github__issue_write`, `method: "update"`,
   `- [ ] #<child>` → `- [x] #<child>`, preserving the rest of the body). Mark the child
   **done** in local state.
8. **For each blocked child** — agent/push failure, exhausted rework, or mergefail —
   post a failure comment (`mcp__github__add_issue_comment`) noting the cause (quoting
   the last review verdict when the cause was a rejection, or the merge conflict with
   `<EPIC_BRANCH>`) and that `.worktrees/<branch>.log` / `.worktrees/<branch>.review.md`
   are retained. **Do not** tick the task-list. Its dependents stay blocked.
9. **For each `.mergefail` child, offer guided recovery.** The runner retains the child's
   worktree at `.worktrees/<branch>/` and its log. Ask the user whether to resolve now.
   On yes: `git -C .worktrees/<branch> fetch origin <EPIC_BRANCH>` then
   `git -C .worktrees/<branch> merge origin/<EPIC_BRANCH>` — this reproduces the same
   conflict in the **child's** direction, where resolving it is safe. The
   `resolving-merge-conflicts` skill takes over from there. Present the resolved diff for
   review before pushing the child branch, then re-run `/execute-epic` so the runner
   integrates it (a re-run replays the review → rework → integrate stages for it, since
   the pushed branch has no merge on the epic branch yet). **Never** push to
   `<EPIC_BRANCH>`. On no, leave the child blocked.
10. If this iteration integrated **zero** children, break (no-progress guard) to avoid
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
  the review gate, the rework loop, and the runner invocation.
- Every child passes an **agentic review** (the runner's `--review` action, a fresh
  headless invocation under `REVIEW_AGENT_EXEC_CMD` — never the agent that wrote the
  code) before it can integrate, and this repeats on every rework round. A **hard
  violation blocks integration and triggers automatic rework**; a **judgement call
  never blocks** and lands only in the ship-note. There is no human on this path, so
  the hard-violation/judgement-call split is the only thing that decides.
- The runner is invoked in pipeline order — plain run → `--review` → `--rework`
  (as needed) → `--integrate` — and is the epic branch's sole writer throughout; the
  agent never merges, it only reads epic-branch state via `mcp__github__list_commits`,
  drives the runner's actions, and opens the final PR.
- Waves auto-advance in a single run: the wave loop keeps invoking the runner on the
  newly-runnable frontier until the epic is complete or blocked.
- Re-running is idempotent — done children are detected from the epic branch; only
  pending children in the current frontier run.
- Never push or commit directly; the runner handles that.
- The agent never writes to the epic branch. A merge conflict at `--integrate` time is
  resolved in the **child branch's** direction (merge `<EPIC_BRANCH>` into the child, per
  the `resolving-merge-conflicts` skill) and re-integrated by the runner on the next
  run — never routed into the rework loop, which is for "this is not what was asked
  for," not for an integration conflict.
- `dry-run` stops after printing the plan (step 7); no runner call, no GitHub writes.
- One `epic → main` PR at completion — no per-child PRs. Per-child traceability comes
  from ship-note comments (including rework-round count and last reason) and epic
  task-list ticking. No comment is posted per rejection — only the final ship-note.
- On clean integration each child is **closed** (agent, `issue_write` → `state:"closed"`,
  `state_reason:"completed"`) and its **branch deleted** (runner, unless
  `KEEP_CHILD_BRANCHES=1`). The **epic** issue and the **epic branch** are never
  closed/deleted by this flow — the epic closes via the `epic → main` PR's `Closes #<epic>`.
