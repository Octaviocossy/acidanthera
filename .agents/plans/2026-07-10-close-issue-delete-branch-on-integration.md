# Plan: Close child issue & delete its branch on epic integration

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _n/a (governance/tooling change, no GitHub issue)_

## Goal

When a **child** issue is successfully integrated into the epic branch, automatically
**close that child issue** and **delete its (now-redundant) branch**. The **epic** issue
and the **epic integration branch** are explicitly left untouched — the epic closes only
when its `epic → main` PR (body `Closes #<epic>`) merges.

## Context

- **What exists today.** `/execute-epic` runs the parallel runner
  (`.agents/scripts/run-parallel-issues.sh --epic <branch>`). The runner is the git
  single-writer: for each child it creates a worktree off the epic branch, lets a headless
  agent implement it, then commits, pushes the child branch (`.pushed`), and merges the
  child into the epic branch (`.merged`) or records a conflict (`.mergefail`). After a run
  the orchestrating agent (which alone holds the GitHub token — the runner is **GitHub-blind
  by design**) reads those ledgers and, for each merged child, posts a ship-note comment and
  ticks the epic task-list. The child **issue stays open** and the child **branch stays on
  origin** forever.
- **What prompted this.** The user wants merged children cleaned up: close the issue, delete
  the branch — but **not** the epic (issue or branch).
- **Hard constraint — the runner cannot touch GitHub issues.** `GITHUB_TOKEN` is never
  sourced by the runner (see `parallel-orchestration.md` → *Adapter Contract → Security*), so
  **closing an issue must be done by the agent via MCP**. Deleting a branch is a pure git/push
  operation, so it belongs in the runner, right where the merge succeeds (the single-writer,
  the exact moment the branch is provably contained in the epic branch).
- **Idempotency must survive.** Re-running `/execute-epic` detects done children from the
  epic branch's commit history (`Merge child #<child>`), **not** from branch existence — so
  deleting a child branch does **not** break done-detection. A defensive reconciliation pass
  closes any done-but-still-open child (interrupted run, or a child merged before this
  feature shipped).
- **Sync burden.** `.agents/commands/custom-init.md` embeds **verbatim copies** of the runner,
  `execute-epic.md`, `parallel-orchestration.md`, `parallel.config.example`, and the
  `AGENTS.md` Parallel-Orchestration prose. Every live-file edit here must be mirrored into
  its embedded copy, byte-for-byte.

### Design decisions (summary)

| Action | Where | Why |
|--------|-------|-----|
| Delete merged **child branch** | **Runner**, in the merge-success arm | Git single-writer; branch is provably merged at that instant; no GitHub token needed |
| Close **child issue** | **Agent** (`/execute-epic` step 8.6), `mcp__github__issue_write` | Only the agent has GitHub access |
| Reconcile (close done-but-open children) | **Agent** (`/execute-epic` step 9) | Self-heals interrupted/legacy runs; pure idempotent MCP |
| Never close epic issue / delete epic branch | — (unchanged) | Epic closes via the `epic → main` PR's `Closes #<epic>`; branch lifecycle is that PR's |

New opt-out: `KEEP_CHILD_BRANCHES` (default `0` = delete). Symmetric with `KEEP_WORKTREES`.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `.agents/scripts/run-parallel-issues.sh` | Add `KEEP_CHILD_BRANCHES` default + delete the child branch after a successful epic merge; update header comment |
| MODIFY | `.agents/commands/execute-epic.md` | Step 8.6: close each merged child issue. Step 9: reconcile done-but-open children. New Rules bullet |
| MODIFY | `.agents/rules/parallel-orchestration.md` | Runner Contract output (branch deletion), Safety & Cleanup table row, Auto-Merge Integration Model prose |
| MODIFY | `.agents/parallel.config.example` | Document `KEEP_CHILD_BRANCHES=0` |
| MODIFY | `.agents/parallel.config` (local, gitignored) | Same comment as the example (not committed; keeps local copy honest) |
| MODIFY | `AGENTS.md` | Parallel-Orchestration wave-flow paragraph + Safety-caps line note the new behavior |
| MODIFY (optional) | `.claude/commands/execute-epic.md` | `description` frontmatter parity (allowed-tools already sufficient) |
| MODIFY (optional) | `.opencode/commands/execute-epic.md` | `description` frontmatter parity |
| MODIFY | `.agents/commands/custom-init.md` | Mirror **every** edit above into its embedded verbatim block |

> **No new tools needed.** Both `execute-epic` wrappers already allow
> `mcp__github__issue_write` (closing) and `Bash(git:*)` (reconciliation). Do **not** add tools.

## Step-by-Step Implementation

> Apply Steps 1–6 to the **live** files first, then Step 7 mirrors them into
> `custom-init.md`, then Step 8 verifies. Order matters only in that Step 7 copies the exact
> text produced in Steps 1–6.

### Step 1 — Runner: add the `KEEP_CHILD_BRANCHES` default

- **File:** `.agents/scripts/run-parallel-issues.sh`
- **Action:** MODIFY (defaults block, currently lines ~34–41)
- **Details:** Immediately after the line

  ```sh
  AGENT_TIMEOUT=${AGENT_TIMEOUT:-1800}      # seconds per issue; 0 disables
  ```

  add:

  ```sh
  KEEP_CHILD_BRANCHES=${KEEP_CHILD_BRANCHES:-0}  # 1 = keep a child's branch after it merges into the epic branch
  ```

  It goes **in the defaults block (before** the `. "$PROJECT_ROOT/.agents/parallel.config"`
  source line ~44**)** so `parallel.config` can override it — exactly like `KEEP_WORKTREES`.
- **Why:** Gives users a documented opt-out; deleting branches is destructive, so keep the
  escape hatch. Default `0` matches the requested behavior.

### Step 2 — Runner: delete the child branch after a successful merge

- **File:** `.agents/scripts/run-parallel-issues.sh`
- **Action:** MODIFY (the `if [ -n "$EPIC_BRANCH" ]` merge-success arm, currently lines ~198–203)
- **Details:** In the success branch, the current tail is:

  ```sh
      echo "$_issue $_branch" >> "$WORKTREES_DIR/.merged"
      log "[#$_issue] OK: merged $_branch into $EPIC_BRANCH"
      release_lock
  ```

  Change it to (insert after `release_lock`, still inside the `then` branch):

  ```sh
      echo "$_issue $_branch" >> "$WORKTREES_DIR/.merged"
      log "[#$_issue] OK: merged $_branch into $EPIC_BRANCH"
      release_lock
      # child is fully contained in the epic branch now; drop its branch unless asked to keep it.
      if [ "$KEEP_CHILD_BRANCHES" -ne 1 ]; then
        if git push origin --delete "$_branch" >>"$_logf" 2>&1; then
          log "[#$_issue] deleted merged branch $_branch (remote)"
        else
          log "[#$_issue] note: could not delete branch $_branch (already gone?) — see $_logf"
        fi
      fi
  ```

  Constraints to preserve:
  - **Only in the success arm** — the `else` (conflict) branch is untouched, so a `.mergefail`
    child keeps its pushed branch for the human to resolve.
  - **Delete happens *after* `release_lock`** — the remote-delete is a per-child, independent
    network op that touches neither `EPIC_WT` nor the epic branch, so it must not hold the
    merge lock (which would serialize deletes needlessly and reduce merge concurrency).
  - **Remote only.** Do **not** delete the local `refs/heads/<branch>` here: when
    `KEEP_WORKTREES=1` the branch is still checked out in `$_wt` and `git branch -D` would
    refuse. The lingering local ref is harmless (re-runs skip done children) and is cleaned by
    the existing `git worktree prune` / `rm -rf .worktrees/` guidance.
  - **Never `EPIC_BRANCH`.** `$_branch` is always the child branch; the epic branch is never a
    delete target.
- **Why:** The runner is the git single-writer and, at this exact point, has just proven the
  child is merged+pushed into the epic branch — the safest possible moment to delete it.

### Step 3 — Runner: update the header comment

- **File:** `.agents/scripts/run-parallel-issues.sh`
- **Action:** MODIFY (top-of-file comment block, currently lines ~15–25)
- **Details:** In the `# --epic <branch> …` paragraph, append a sentence noting the deletion,
  and add `KEEP_CHILD_BRANCHES` to the outputs/behavior note. Concretely, after the existing
  line:

  ```
  #                   counts as a failure for this run's exit status.
  ```

  add:

  ```
  #                   On a clean merge the child's branch is deleted from origin (unless
  #                   KEEP_CHILD_BRANCHES=1) — it is fully contained in the epic branch.
  ```
- **Why:** Keep the runner's self-documentation truthful; the header is the first thing a
  maintainer reads.

### Step 4 — `execute-epic.md`: close the child issue (step 8.6) + reconcile (step 9)

- **File:** `.agents/commands/execute-epic.md`
- **Action:** MODIFY
- **Details:**

  **(4a) Step 8, item 6** — replace the current item 6:

  > 6. **For each merged child:** post a ship-note comment to the child issue
  >    (`mcp__github__add_issue_comment`, mirroring `/ship-note`: Summary, Files changed
  >    from `.worktrees/<branch>.log`, Validation, and the `#<child> → <EPIC_BRANCH>`
  >    integration reference), then tick the epic task-list item
  >    (`mcp__github__issue_write`, `method: "update"`, `- [ ] #<child>` → `- [x] #<child>`,
  >    preserving the rest of the body). Mark the child **done** in local state.

  with:

  > 6. **For each merged child:** post a ship-note comment to the child issue
  >    (`mcp__github__add_issue_comment`, mirroring `/ship-note`: Summary, Files changed
  >    from `.worktrees/<branch>.log`, Validation, and the `#<child> → <EPIC_BRANCH>`
  >    integration reference); **close the child issue** (`mcp__github__issue_write`,
  >    `method: "update"`, `state: "closed"`, `state_reason: "completed"`) — the runner has
  >    already deleted its branch; then tick the epic task-list item
  >    (`mcp__github__issue_write`, `method: "update"`, `- [ ] #<child>` → `- [x] #<child>`,
  >    preserving the rest of the body). Mark the child **done** in local state.

  **(4b) Step 9** — insert a new **first** bullet under `### 9 …`, before the existing
  "If **all** children are done…" bullet:

  > - **Reconcile done children (self-heal).** For every child classified **done**, make sure
  >   its GitHub issue is closed: fetch the still-open set once with
  >   `mcp__github__list_issues { owner, repo, state:"open" }` and, for any done child still in
  >   it, `mcp__github__issue_write` (`method:"update"`, `state:"closed"`,
  >   `state_reason:"completed"`). This catches children merged in a prior/interrupted run or
  >   before per-child closing existed. **Do not** touch child branches here — branch lifecycle
  >   is the runner's (it honors `KEEP_CHILD_BRANCHES`). **Never** close the **epic** issue —
  >   it closes when the `epic → main` PR merges.

  **(4c) Rules** — append a bullet to the `## Rules` list:

  > - On clean integration each child is **closed** (agent, `issue_write` → `state:"closed"`,
  >   `state_reason:"completed"`) and its **branch deleted** (runner, unless
  >   `KEEP_CHILD_BRANCHES=1`). The **epic** issue and the **epic branch** are never
  >   closed/deleted by this flow — the epic closes via the `epic → main` PR's `Closes #<epic>`.
- **Why:** Puts issue-closing where the token lives (the agent), keeps timely per-child
  feedback in the wave loop, and adds an idempotent safety net without giving the runner
  GitHub access.

### Step 5 — `parallel-orchestration.md`: contract, safety table, integration-model prose

- **File:** `.agents/rules/parallel-orchestration.md`
- **Action:** MODIFY (three spots)
- **Details:**

  **(5a) Runner Contract → Output** (currently lines ~169–180): after the `.merged` /
  `.mergefail` bullet ("When `--epic` is set: after a child's own push succeeds…"), add:

  > - When `--epic` is set and a child integrates cleanly, the runner then **deletes that
  >   child's branch from origin** (`git push origin --delete`, unless
  >   `KEEP_CHILD_BRANCHES=1`) — the child is fully contained in the epic branch. A merge
  >   conflict never deletes the branch (it stays pushed for a human to resolve).

  **(5b) Safety & Cleanup table** (currently lines ~214–221): add a row after the
  `EPIC_MERGE_FLAGS` row:

  > | `KEEP_CHILD_BRANCHES` | 0 | 1 = keep a child's branch after it merges into the epic branch (default deletes it from origin) |

  **(5c) Auto-Merge Integration Model** (currently lines ~257–266): extend the first
  paragraph so the closing/deletion is documented. Replace:

  > …auto-merges every successful child into the epic branch as soon as its own push
  > succeeds, so the next wave's frontier becomes runnable with **no manual merge step**.
  > A single `/execute-epic` invocation loops this wave-by-wave until the epic is fully
  > integrated or blocked, then opens **one `epic → main` PR**.

  with:

  > …auto-merges every successful child into the epic branch as soon as its own push
  > succeeds, then **deletes that child's now-redundant branch** (unless
  > `KEEP_CHILD_BRANCHES=1`), so the next wave's frontier becomes runnable with **no manual
  > merge step**. Per child, `/execute-epic` also **closes the integrated child issue**. A
  > single `/execute-epic` invocation loops this wave-by-wave until the epic is fully
  > integrated or blocked, then opens **one `epic → main` PR**. The **epic** issue is closed
  > by that PR's `Closes #<epic>`; neither the epic issue nor the epic branch is
  > closed/deleted mid-flow.
- **Why:** The rule file is the canonical contract; the runner and command edits must be
  reflected here so the three stay consistent.

### Step 6 — Config example + local config + AGENTS.md

- **Files:** `.agents/parallel.config.example`, `.agents/parallel.config` (local), `AGENTS.md`
- **Action:** MODIFY
- **Details:**

  **(6a) `.agents/parallel.config.example`** — after the `KEEP_WORKTREES=0 …` line (~28):

  ```
  KEEP_CHILD_BRANCHES=0          # 1 = keep a child's branch after it merges into the epic
                                  # branch (default 0 deletes the merged child branch from origin)
  ```

  **(6b) `.agents/parallel.config`** (local, gitignored) — add the same line so the operator's
  live config documents the knob. Not committed; do it for parity only.

  **(6c) `AGENTS.md` → `## Parallel Orchestration`** — in the **Wave flow** paragraph, after
  "auto-merges each child branch into the epic branch — waves advance with no manual merge.",
  append: " Each integrated child issue is **closed** and its branch **deleted** (opt out with
  `KEEP_CHILD_BRANCHES=1`)." Optionally add `KEEP_CHILD_BRANCHES` to the **Safety caps** line.
  (Leave the `Available: execute-epic …` line as-is unless you also update the wrapper
  descriptions in the optional step below.)
- **Why:** Discoverability — `AGENTS.md` and the config example are where an operator learns
  the knob exists.

### Step 6b (OPTIONAL) — wrapper `description` parity

- **Files:** `.claude/commands/execute-epic.md`, `.opencode/commands/execute-epic.md`, and the
  `AGENTS.md` `Available: execute-epic …` line.
- **Action:** MODIFY (frontmatter `description` only; **do not** change `allowed-tools` —
  `issue_write` + `Bash(git:*)` are already present)
- **Details:** If you want the one-liner honest, extend the description to
  "…auto-merging each wave into the epic integration branch (closing each child issue and
  deleting its merged branch), then open one epic PR." Keep the two wrapper descriptions
  **identical** to each other and to the `AGENTS.md` Available line.
- **Why:** Purely cosmetic/discoverability; skip if minimizing churn. If done, remember these
  wrapper blocks are **also** embedded in `custom-init.md` (Step 7).

### Step 7 — Mirror every edit into `custom-init.md`

- **File:** `.agents/commands/custom-init.md`
- **Action:** MODIFY (the embedded verbatim blocks)
- **Details:** For **each** live file changed above, find its embedded copy and apply the
  **identical** edit so the block stays byte-for-byte equal to the live file. Approximate
  anchors (they shift as you edit — re-grep to confirm):

  | Live file edited | Embedded block header in `custom-init.md` | Approx. anchor |
  |------------------|-------------------------------------------|----------------|
  | `run-parallel-issues.sh` (Steps 1–3) | `### File: .agents/scripts/run-parallel-issues.sh` | ~line 1751; defaults ~1793, merge arm ~1954, header ~1755 |
  | `execute-epic.md` (Step 4) | `### File: .agents/commands/execute-epic.md` | ~line 2217; step 8.6 ~2322, step 9 ~2335, Rules ~2348 |
  | `parallel-orchestration.md` (Step 5) | `### File: .agents/rules/parallel-orchestration.md` | ~line 1468; Output ~1670s, Safety table ~1689, Integration Model further down |
  | `parallel.config.example` (Step 6a) | `### File: .agents/parallel.config.example` | ~line 2020; `KEEP_WORKTREES` ~2050 |
  | `AGENTS.md` Parallel-Orch prose (Step 6c) | embedded `## Parallel Orchestration` | ~lines 743–767 |
  | `.claude/…/execute-epic.md` (Step 6b, if done) | `### File: .claude/commands/execute-epic.md` | ~line 2446 |
  | `.opencode/…/execute-epic.md` (Step 6b, if done) | `### File: .opencode/commands/execute-epic.md` | ~line 2514 |

  Use grep to locate exact lines rather than trusting the numbers, e.g.:

  ```sh
  grep -n 'release_lock\|EPIC_MERGE_FLAGS\|KEEP_WORKTREES\|For each merged child\|Reconcile done' .agents/commands/custom-init.md
  ```
- **Why:** `custom-init.md` is the bootstrap source for new repos; a drifted block would ship
  the old behavior to every project initialized after this change.

### Step 8 — Verify

- **File:** _n/a (verification only)_
- **Details:** Run, in order:
  1. `sh -n .agents/scripts/run-parallel-issues.sh` — shell parses cleanly.
  2. `pnpm check` — repo lint/format stays green (no TS touched; sanity only).
  3. **Byte-identical check** of every mirrored block: extract each fenced block from
     `custom-init.md` (fence-depth-aware, since the runner block itself contains ``` fences)
     and `diff` it against the live file. All must be empty diffs. (Reuse the fence-depth-aware
     extraction from the prior epic-auto-merge sync verification.)
- **Why:** Guards the two failure modes of this change — a shell typo in the delete block, and
  `custom-init.md` drift.

## Architecture Decisions

- **Split by capability, not convenience.** Branch deletion is git → runner; issue closing is
  GitHub API → agent. This respects the existing, deliberate rule that the runner is
  GitHub-blind (`GITHUB_TOKEN` never sourced). Putting the delete in the runner also makes it
  atomic with the merge (single-writer, provably-merged instant) rather than a later, racier
  agent step.
- **Remote-only branch deletion.** The GitHub-visible branch is what "delete the branch" means
  to the user. The local `refs/heads/<branch>` in the primary repo is left (harmless; cleaned
  by existing worktree-prune guidance) to avoid the `git branch -D` "checked out in worktree"
  failure when `KEEP_WORKTREES=1`.
- **Reconciliation closes issues but never deletes branches.** The agent's step-9 sweep is
  pure, idempotent MCP (`issue_write state:closed`). It deliberately does **not** delete
  branches, so it can never override an operator's `KEEP_CHILD_BRANCHES=1` preference — branch
  lifecycle stays solely the runner's, which honors that flag.
- **Idempotency preserved.** Done-detection keys off the epic branch's `Merge child #<child>`
  commits, not branch existence, so deleting branches is safe across re-runs. Closing an
  already-closed issue is a no-op; the step-9 sweep first filters to `state:"open"` to avoid
  even that.
- **Epic untouched, by contract.** "(not epic)" is honored in three places: the runner only
  ever deletes `$_branch` (a child); the agent's close/reconcile never targets the epic issue;
  and the epic's own closure remains the `epic → main` PR's `Closes #<epic>` — unchanged.
- **New knob mirrors the existing one.** `KEEP_CHILD_BRANCHES` parallels `KEEP_WORKTREES`
  (name, default, config placement, table row) so operators meet no new idiom.

## Validation Criteria

- [x] `sh -n .agents/scripts/run-parallel-issues.sh` passes.
- [x] `pnpm check` passes (no regressions).
- [x] Every `custom-init.md` embedded block that was mirrored `diff`s byte-identical to its
      live file (runner, `execute-epic.md`, `parallel-orchestration.md`,
      `parallel.config.example`, `AGENTS.md` prose, and — if Step 6b was done — both wrappers).
- [ ] **Runner unit behavior (sandbox git repo, no GitHub):** with `--epic <branch>` and a
      clean two-child wave, both child branches are **absent** from the sandbox origin after
      the run, `.merged` lists both, and each `.worktrees/<branch>.log` shows the delete line.
- [ ] **Opt-out:** the same sandbox run with `KEEP_CHILD_BRANCHES=1` **keeps** both child
      branches on origin.
- [ ] **Conflict path unchanged:** a genuine merge-conflict child stays pushed (branch present
      on origin), is recorded in `.mergefail`, and the run exits non-zero.
- [ ] **Backward-compat:** a plain wave (no `--epic`) never deletes any branch.
- [ ] **Agent path (real GitHub, manual smoke or next real `/execute-epic`):** an integrated
      child issue ends **closed** with `state_reason: completed`; the epic issue stays **open**
      until its PR merges; the child branch is gone from GitHub.

## Open Questions

None. The runner-vs-agent split is forced by the GitHub-blind-runner constraint, and
`KEEP_CHILD_BRANCHES` defaults to the requested delete-on-merge behavior. Step 6b (wrapper
description parity) is optional and flagged as such — proceed either way.

## Implementation Notes

- Steps 1–7 applied as specified; Step 6b (wrapper `description` parity) was **skipped** to
  minimize churn — allowed-tools were already sufficient and the plan flagged it optional.
- Step 8 verification: `sh -n` passed, `pnpm check` passed (Biome, 80 files, no issues), and
  all mirrored `custom-init.md` blocks (`run-parallel-issues.sh`, `execute-epic.md`,
  `parallel-orchestration.md`, `parallel.config.example`, and the `AGENTS.md` Parallel
  Orchestration section) diffed byte-identical to their live counterparts.
- The runner unit-behavior and agent-path validation checkboxes below require an actual
  sandbox `--epic` run / real `/execute-epic` invocation and were not exercised in this
  session — left unchecked for a future live run to confirm.
