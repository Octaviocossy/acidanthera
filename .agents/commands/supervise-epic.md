# Command: supervise-epic

Execute the children of a GitHub **epic** issue against a dedicated **epic integration
branch**, exactly like `/execute-epic`, but with a **human review gate** in front of
every merge: each child is pushed, passed through the agentic review, then presented to
you — diff, log, and report — for an explicit approve/reject decision before the runner
integrates it. Runs every runnable wave to completion in one invocation, then opens a
**single `epic → main` pull request**. Re-running is idempotent.

`$ARGUMENTS` is **optional**: `skip confirm` (skip step 7) or `dry-run` (stop after
step 7, printing the plan but not running the runner). Neither argument skips the
per-child review gate in step 8 — that decision is the entire point of this command.

## Context injected by the wrapper

- **Repository remote URL** — parse `owner`/`repo` from the injected
  `git remote get-url origin` output (HTTPS or SSH).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## User-invocable only

This command must never run inside a headless parallel-runner child
(`.agents/scripts/run-parallel-issues.sh`) — there is nobody there to answer the
per-child review gate in step 8, and an agent answering its own review would defeat the
entire purpose of a *human* review gate. This is the same boundary
`design-interrogation.md` draws around `/grill`:

| Agent | Enforcement |
|-------|-------------|
| Claude Code | `disable-model-invocation: true` in `.claude/commands/supervise-epic.md` — user-invoked only |
| OpenCode | No equivalent frontmatter field; this paragraph is the enforcement — never dispatch `/supervise-epic` from inside a headless run |

For unattended execution use `/execute-epic` instead — it runs the identical pipeline
but resolves every child with the agentic review alone, never a human.

## Instructions

Steps 1–7 and 9 are the same procedure `/execute-epic` follows —
`.agents/rules/parallel-orchestration.md` is the shared trunk both commands include.
Step 8 is where the two commands diverge: this command adds a human decision per child
before anything is integrated.

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
- **blocked (this session)** — appears in `.worktrees/.failed` or `.worktrees/.mergefail`
  after a run, or exhausted `MAX_REWORK_ROUNDS` under the review gate (step 8).
- **pending** — otherwise.

If every child is already done, skip to step 9 (open/verify the epic PR).

### 7 — Confirm

Unless `$ARGUMENTS` contains `skip confirm`, print and wait for explicit confirmation:

- Epic title and number
- The **integration branch** name (`EPIC_BRANCH`)
- Full wave plan (all waves, marking done/pending per child)
- The `AGENT_EXEC_CMD` and `REVIEW_AGENT_EXEC_CMD` that will be used
- Concurrency cap (`PARALLEL_MAX_CONCURRENCY`) and rework cap (`MAX_REWORK_ROUNDS`)
- A reminder that every child pauses for your decision at the review gate before it
  can integrate
- Any warnings (CLI not on PATH, children > `MAX_CHILDREN`, etc.)

If `$ARGUMENTS` contains `dry-run`, stop here after printing the plan.

### 8 — Wave loop (auto-advance, gated by human review)

Repeat until no progress:

1. Compute the **frontier** = pending children whose **every** dependency is **done**
   (merged into the epic branch).
2. If the frontier is empty **and** pending children remain, their dependencies failed,
   conflicted, or exhausted rework → report which children are blocked and why, then
   break the loop.
3. If the frontier is empty **and** no pending children remain → the epic is fully
   integrated → go to step 9.
4. **Push stage.** For each child in the frontier, write its issue body to
   `.worktrees/<branch>.issue.md` — fetch with `mcp__github__issue_read`
   (`method: "get"`). The implementing agent dispatched next has no GitHub access by
   design (Adapter Contract); without this file it falls back to "implement the issue
   body as described in #<child>", which it cannot do. The reviewer dispatched later
   reads the same file for its Spec axis — without it, the Spec axis would silently
   fall back to the plan file and miss a case where the issue and the plan diverged.
   Also write the epic issue's body (already fetched in step 2) once per session to
   `.worktrees/.epic-issue.md` — shared by every child. The reviewer passes it to the
   Spec axis for the child's intended scope; without it, the skill's "read the epic
   issue" instruction is a silent no-op headless (no GitHub access by design).
   Then invoke the runner with no action flag:
   ```sh
   sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> \
     "<issue>:<branch>:<title>" "<issue>:<branch>:<title>" ...
   ```
   Wait for it to finish. Read `.worktrees/.pushed` and `.worktrees/.failed`
   (Runner Contract, plain-run outputs).
5. **Agentic review.** Invoke the runner's `--review` action over the pushed children:
   ```sh
   sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> --review \
     "<issue>:<branch>:<title>" "<issue>:<branch>:<title>" ...
   ```
   This writes `.worktrees/<branch>.review.md` per child (the Standards + Spec report
   from `standards-and-spec-review`, run against `<EPIC_BRANCH>` as the fixed point);
   reads the `.worktrees/<branch>.issue.md` already written in the push stage above.
6. **The review gate — one decision per child.** For each reviewed child, present:
   - Diffstat: `git -C .worktrees/<branch> diff --stat <EPIC_BRANCH>...HEAD`
   - Full diff: `git -C .worktrees/<branch> diff <EPIC_BRANCH>...HEAD`
   - The agent's implementation log: `.worktrees/<branch>.log`
   - The agentic review report: `.worktrees/<branch>.review.md`
   - **Pre-selection:** if the report contains a **hard violation**, pre-select
     "reject" with that violation's reason shown — you may still approve anyway. A
     **judgement call** never pre-selects anything; you weigh it yourself. (Severity
     definitions: `.agents/ubiquitous-language.md` › Branch review.)

   Ask for an explicit **approve** or **reject** per child. On reject, ask for written
   feedback (may be left blank — the agentic report alone is still passed on).
7. **Rejected children → rework.** For each rejected child:
   - Count existing `rework(#<issue>): ronda <n>` commits on its branch (`git -C
     .worktrees/<branch> log --oneline --grep="^rework(#<issue>):"`) against
     `MAX_REWORK_ROUNDS`. If the cap is already reached (or `MAX_REWORK_ROUNDS=0`),
     the child is **blocked** — skip to the blocked handling below; do not rework it.
   - Otherwise, write `.worktrees/<branch>.feedback` = your written text (if any) plus
     the full contents of `.worktrees/<branch>.review.md`.
   - Invoke the runner's `--rework` action for the still-eligible rejected children in
     one call:
     ```sh
     sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> --rework \
       "<issue>:<branch>:<title>" ...
     ```
   - A child that lands in `.worktrees/.failed` after `--rework` is **blocked** — the
     re-dispatch itself failed (agent/worktree/push failure).
   - Every other reworked child **returns to sub-step 5** (re-review) — the review
     re-runs every round, since a rework can break something the prior round approved.
8. **Approved children → integrate.** Once a child is approved (immediately, or after
   surviving rework and re-review), invoke the runner's `--integrate` action:
   ```sh
   sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> --integrate \
     "<issue>:<branch>:<title>" ...
   ```
   Read `.worktrees/.merged` (integrated) and `.worktrees/.mergefail` (merge
   conflict — branch pushed but not integrated).
9. **For each merged child:** post a ship-note comment to the child issue
    (`mcp__github__add_issue_comment`, mirroring `/ship-note`: Summary, Files changed
    from `.worktrees/<branch>.log`, Validation, how many rework rounds ran and the last
    rejection reason if any, and the `#<child> → <EPIC_BRANCH>` integration reference);
    **close the child issue** (`mcp__github__issue_write`, `method: "update"`,
    `state: "closed"`, `state_reason: "completed"`) — the runner has already deleted
    its branch; then tick the epic task-list item (`mcp__github__issue_write`,
    `method: "update"`, `- [ ] #<child>` → `- [x] #<child>`, preserving the rest of the
    body). Mark the child **done** in local state.
10. **For each `.mergefail` child, offer guided recovery** — a merge conflict is an
    integration problem, never a rework trigger (Edges, decision 16). The runner
    retains the child's worktree at `.worktrees/<branch>/` and its log. Ask the user
    whether to resolve now. On yes:
    `git -C .worktrees/<branch> fetch origin <EPIC_BRANCH>` then
    `git -C .worktrees/<branch> merge origin/<EPIC_BRANCH>` — this reproduces the same
    conflict in the **child's** direction, where resolving it is safe. The
    `resolving-merge-conflicts` skill takes over from there. Present the resolved diff
    for review before pushing the child branch, then loop back to this wave's
    `--integrate` call so the runner integrates it. **Never** push to `<EPIC_BRANCH>`.
    On no, leave the child blocked.
11. **For each blocked child** (rework cap exhausted, or `--rework`/`--review` itself
    failed): post a comment noting the cause and that `.worktrees/<branch>.log` (and
    `.review.md`, if present) are retained. **Do not** tick the task-list. Its
    dependents stay blocked.
12. If this iteration merged **zero** children, break (no-progress guard) to avoid
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
  child → status table (including rework-round counts per child) and the epic PR URL.
- If some children are blocked: **do not** open the epic PR; report the blocked set and
  stop (re-running `/supervise-epic` after the human resolves the blockage is
  idempotent — already-merged children are detected as done in step 6).

## Rules

- Follow `issue-resolution.md` to identify the epic from the current branch.
- Follow `parallel-orchestration.md` for wave computation, the epic integration branch,
  the Runner Contract, the review gate, and the rework loop.
- The runner integrates each child into the epic branch; the agent never merges — it
  only reads epic-branch state via `mcp__github__list_commits` and opens the final PR.
- **Every child passes through the review gate before it can integrate.** There is no
  path in this command that calls `--integrate` on a child that has not been approved
  by an explicit human decision this session.
- A hard violation in the agentic review pre-selects "reject"; a judgement call never
  does. Either way the human decision is final — the report informs it, it never
  substitutes for it.
- A rejection triggers rework (up to `MAX_REWORK_ROUNDS`); a merge conflict at
  integration time never does — it goes to guided recovery in the child's direction.
- Waves auto-advance in a single run: the wave loop keeps invoking the runner on the
  newly-runnable frontier until the epic is complete or blocked. Within a wave, the
  loop does not advance to the next wave until every child in the current one is either
  integrated or blocked — approved children are not held back by a sibling still in
  rework, but the wave itself is not "done" until all of its children resolve one way
  or the other.
- Re-running is idempotent — done children are detected from the epic branch; only
  pending children in the current frontier run; rework round counts are re-derived from
  git commits, never stored.
- Never push or commit directly; the runner handles that. The agent never writes to the
  epic branch.
- `dry-run` stops after printing the plan (step 7); no runner call, no GitHub writes.
  Neither `dry-run` nor `skip confirm` skips the per-child review gate in step 8.
- One `epic → main` PR at completion — no per-child PRs. Per-child traceability comes
  from ship-note comments (including rework-round counts) and epic task-list ticking.
- On clean integration each child is **closed** (agent, `issue_write` → `state:"closed"`,
  `state_reason:"completed"`) and its **branch deleted** (runner, unless
  `KEEP_CHILD_BRANCHES=1`). The **epic** issue and the **epic branch** are never
  closed/deleted by this flow — the epic closes via the `epic → main` PR's `Closes #<epic>`.
- Never invoke this command, and never let it be invoked, from inside a headless
  parallel-runner child — see User-invocable only, above.
