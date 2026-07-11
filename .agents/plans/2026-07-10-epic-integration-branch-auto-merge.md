# Plan: Epic Integration Branch with Auto-Merge (drop manual-merge checkpoint)

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none yet_

## Goal

Change parallel orchestration so that each **epic** gets its own long-lived **integration
branch**, each child issue gets its own branch (as today), and the runner **automatically
merges every successful child branch into the epic integration branch**. Wave progression
then advances **without any manual PR merge** — `/execute-epic` runs every runnable wave to
completion in one invocation and opens a **single `epic → main` pull request** at the end,
replacing today's "one PR per child + manual merge checkpoint between waves" model.

## Context

### What exists today

- **Runner** (`.agents/scripts/run-parallel-issues.sh`): for each child record
  `<issue>:<branch>:<title>`, it creates a git worktree + branch off `BASE_BRANCH` (`main`),
  runs a headless agent to implement the issue, then commits and **pushes the child branch**.
  It never touches GitHub. Outputs: `.worktrees/.pushed` (success) and `.worktrees/.failed`.
  Exit code = number of failed children.
- **`/execute-epic`** (`.agents/commands/execute-epic.md`): resolves the epic, computes waves
  (Kahn leveling), determines the runnable **frontier** (children whose deps are **merged into
  `main`**), runs the runner for that frontier, then **opens one PR per child** (`Closes
  #<child>`, base `main`), posts ship-notes, ticks the epic task-list, and **stops at a manual
  merge checkpoint** — the user must merge that wave's PRs into `main` before re-running to
  advance. Frontier detection reads PR state via `mcp__github__list_pull_requests`.
- **`/spec`** chains `/spec-breakdown` → `/execute-epic`, stopping at the same checkpoint.
- **Rule** `.agents/rules/parallel-orchestration.md` documents the epic/child model, the
  "Manual-Merge Checkpoint Model", branch naming (`epic/<slug>`, children `<issue#>-<title>`),
  the runner/adapter contracts, and the wave/frontier algorithm.
- **Mirror**: `.agents/commands/custom-init.md` embeds **verbatim template copies** of the
  runner, the rule, all three orchestration command specs, the config, both wrappers, and the
  `AGENTS.md` "Parallel Orchestration" section, so a fresh project can be scaffolded. These
  copies must be kept in sync with the live files.

### What prompts this work

User request (paraphrased): create a branch per epic and a branch per issue, and have the
issue branches **auto-merge into the epic branch** so that wave progression no longer depends
on a manual merge.

### Constraints the implementer must know

- **Architecture boundary is load-bearing**: the runner does **only local git + `push`** and
  has **no GitHub API access** (`GITHUB_TOKEN` is never sourced — headless agents are
  GitHub-blind by design). The orchestrating agent does **all GitHub API work via MCP**. This
  plan preserves that split: the runner becomes the **single writer** of the epic integration
  branch (local merge + push); the agent only **reads** epic-branch state (via MCP) and opens
  the final PR / posts comments.
- Cross-agent parity: `.claude/commands/*` and `.opencode/commands/*` wrapper **bodies must
  stay identical**; only frontmatter differs (`command-creation.md`).
- The Claude `execute-epic` wrapper pre-approves `Bash(sh .agents/scripts/run-parallel-issues.sh:*)`.
  The new runner argument must keep the invocation **starting with `sh
  .agents/scripts/run-parallel-issues.sh …`** so the allow-pattern still matches — hence a
  `--epic <branch>` **positional flag**, not an `EPIC_BRANCH=… sh …` env prefix (which would
  not match and would prompt).
- Same-wave children are independent by construction (Kahn leveling → no intra-wave edges), so
  their merges into the epic branch should not conflict; cross-wave children branch off the
  **updated** epic branch and build on prior waves. Git-level serialization of the merge+push
  is still required (single shared branch) → a lock.
- This is **orchestration tooling**, not app domain code. `.agents/ubiquitous-language.md` is
  the app's domain glossary and is intentionally **not** touched by this plan.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `.agents/scripts/run-parallel-issues.sh` | Add `--epic <branch>` flag; ensure/create the epic branch; cut children off the epic branch; after each successful child push, merge the child into the epic branch (serialized via lock) and push it; new `.merged`/`.mergefail` ledgers; count merge-conflicts as failures. |
| MODIFY | `.agents/commands/execute-epic.md` | Derive the integration branch from the epic; detect done children by epic-branch merge (not main-PR); loop **all** runnable waves in one run (auto-advance, no manual checkpoint); pass `--epic` to the runner; open **one `epic → main` PR** at completion; drop per-child PRs (keep ship-notes + task-list ticking); handle merge-conflict children. |
| MODIFY | `.agents/commands/spec.md` | Phase 3 wording: auto-advances all waves, no manual checkpoint, ends with one `epic → main` PR. |
| MODIFY | `.agents/commands/spec-breakdown.md` | Record the integration branch name in the epic plan file header/template. |
| MODIFY | `.agents/rules/parallel-orchestration.md` | Add the Epic Integration Branch model; update Branch Naming (`epic/<epic#>-<slug>`), Runner Contract (`--epic`, `.merged`/`.mergefail`, merge behavior, lock/single-writer), Wave/Frontier ("done" = merged into epic branch); replace the Manual-Merge Checkpoint Model with the Auto-Merge Integration Model (move manual checkpoint to documented opt-ins); Safety table additions. |
| MODIFY | `.agents/rules/issue-resolution.md` | Update the epic-branch note: integration branch is `epic/<epic#>-<slug>` and resolves via precedence #1 (numeric), not fuzzy. |
| MODIFY | `.agents/parallel.config.example` | Re-comment `BASE_BRANCH` (now: the branch the epic branch is cut from); note `EPIC_BRANCH` is passed per-run by `/execute-epic` via `--epic`, not configured here; document `EPIC_MERGE_FLAGS` (default `--no-ff`). |
| MODIFY | `.agents/parallel.config` | Same comment updates as the example (local, gitignored copy). |
| MODIFY | `AGENTS.md` | Rewrite the "Parallel Orchestration" › **Wave flow** paragraph to the auto-merge model. |
| MODIFY | `.claude/commands/execute-epic.md` | Add `mcp__github__list_commits` to `allowed-tools`; update `description`. Body still `@`-includes the canonical spec. |
| MODIFY | `.opencode/commands/execute-epic.md` | Update `description` to match (body identical to Claude wrapper). |
| MODIFY | `.claude/commands/spec.md` | Add `mcp__github__list_commits` to `allowed-tools` (spec delegates to execute-epic). |
| MODIFY | `.opencode/commands/spec.md` | Description parity only (body identical). |
| MODIFY | `.agents/commands/custom-init.md` | Mirror **every** above edit into its embedded template copies (runner block, rule block, `execute-epic`/`spec`/`spec-breakdown` blocks, config block, `AGENTS.md` section block, wrapper `allowed-tools`). Mechanical but must stay in sync. |
| CREATE | _(this file)_ `.agents/plans/2026-07-10-epic-integration-branch-auto-merge.md` | The plan itself. |

## Step-by-Step Implementation

Do the steps in order. The runner (Step 1) is the highest-risk change; get it right first, then
the command that drives it (Step 2), then docs/mirrors.

---

> **Step 1 — Rewrite the runner to support an epic integration branch with auto-merge**
>
> - **File:** `.agents/scripts/run-parallel-issues.sh`
> - **Action:** MODIFY
> - **Why:** The runner already owns local git + push and is the natural, GitHub-free place to
>   merge children into the epic branch, so waves advance with no manual step.
>
> **1a. Parse the `--epic <branch>` flag before the usage/`MAX_CHILDREN` checks.**
> Insert right after the config `. .agents/parallel.config` sourcing (current line ~32) and
> **before** the `if [ "$#" -eq 0 ]` usage check (so the checks count only child records):
>
> ```sh
> # ---- optional epic integration branch (enables the auto-merge model) ----
> EPIC_BRANCH=${EPIC_BRANCH:-}
> if [ "${1:-}" = "--epic" ]; then
>   [ "$#" -ge 2 ] || { log "FATAL: --epic requires a branch argument"; exit 2; }
>   EPIC_BRANCH=$2
>   shift 2
> fi
> EPIC_MERGE_FLAGS=${EPIC_MERGE_FLAGS:---no-ff}   # how children merge into the epic branch
> EPIC_WT="$WORKTREES_DIR/__epic__"               # dedicated checkout of the epic branch
> MERGE_LOCK="$WORKTREES_DIR/.merge.lock"         # serialize merge+push (single writer)
> ```
>
> **1b. Add lock + ensure-branch helpers** (place near the existing `run_with_timeout` helper):
>
> ```sh
> acquire_lock() { until mkdir "$MERGE_LOCK" 2>/dev/null; do sleep 1; done; }
> release_lock() { rmdir "$MERGE_LOCK" 2>/dev/null || true; }
>
> # Create/refresh the epic worktree so it sits at the epic branch's current tip.
> # If the branch already exists on origin, check that out; else cut it from BASE_BRANCH
> # and publish it. Runs once, before any child fans out. No-op when EPIC_BRANCH is empty.
> ensure_epic_branch() {
>   [ -n "$EPIC_BRANCH" ] || return 0
>   # Guard: refuse if the epic branch is checked out in the PRIMARY worktree (we cannot
>   # also check it out here). The user should run /execute-epic from main or another branch.
>   _cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
>   if [ "$_cur" = "$EPIC_BRANCH" ]; then
>     log "FATAL: epic branch '$EPIC_BRANCH' is checked out in the primary worktree."
>     log "       Check out 'main' (or any other branch) before running the epic runner."
>     exit 5
>   fi
>   git fetch --quiet origin >/dev/null 2>&1 || true
>   [ -e "$EPIC_WT" ] && { git worktree remove --force "$EPIC_WT" >/dev/null 2>&1 || rm -rf "$EPIC_WT"; }
>   if git ls-remote --exit-code --heads origin "$EPIC_BRANCH" >/dev/null 2>&1; then
>     git worktree add -B "$EPIC_BRANCH" "$EPIC_WT" "origin/$EPIC_BRANCH" >/dev/null 2>&1
>   else
>     git worktree add -B "$EPIC_BRANCH" "$EPIC_WT" "origin/$BASE_BRANCH" >/dev/null 2>&1 \
>       || git worktree add -B "$EPIC_BRANCH" "$EPIC_WT" "$BASE_BRANCH" >/dev/null 2>&1
>     git -C "$EPIC_WT" push -u origin "$EPIC_BRANCH" >/dev/null 2>&1
>   fi
> }
> ```
>
> **1c. Cut children off the epic branch when set.** In `process_issue`, replace the base ref
> used by `git worktree add … -b "$_branch" "$BASE_BRANCH"` with a computed base:
>
> ```sh
> _base_ref=${EPIC_BRANCH:-$BASE_BRANCH}
> ...
>   git worktree add "$_wt" -b "$_branch" "$_base_ref" >>"$_logf" 2>&1
> ```
> Also update the start log line: `log "[#$_issue] start -> $_branch (base $_base_ref)"`.
>
> **1d. After the successful child push, merge the child into the epic branch (serialized).**
> In `process_issue`, the current success tail is: commit → `push -u origin "$_branch"` →
> `echo "$_issue $_branch" >> .pushed` → cleanup → `return 0`. Keep the push and the `.pushed`
> write, then **insert the merge block before cleanup/return**:
>
> ```sh
>   # child branch is pushed and recorded in .pushed above; now integrate it.
>   if [ -n "$EPIC_BRANCH" ]; then
>     acquire_lock
>     git -C "$EPIC_WT" fetch --quiet origin "$EPIC_BRANCH" >>"$_logf" 2>&1
>     git -C "$EPIC_WT" reset --hard "origin/$EPIC_BRANCH" >>"$_logf" 2>&1
>     # shellcheck disable=SC2086
>     if git -C "$EPIC_WT" merge $EPIC_MERGE_FLAGS "$_branch" \
>          -m "Merge child #$_issue ($_branch) into $EPIC_BRANCH" >>"$_logf" 2>&1 \
>        && git -C "$EPIC_WT" push origin "$EPIC_BRANCH" >>"$_logf" 2>&1; then
>       echo "$_issue $_branch" >> "$WORKTREES_DIR/.merged"
>       log "[#$_issue] OK: merged $_branch into $EPIC_BRANCH"
>       release_lock
>     else
>       git -C "$EPIC_WT" merge --abort >>"$_logf" 2>&1 || true
>       git -C "$EPIC_WT" reset --hard "origin/$EPIC_BRANCH" >>"$_logf" 2>&1 || true
>       echo "$_issue" >> "$WORKTREES_DIR/.mergefail"
>       log "[#$_issue] MERGEFAIL: $_branch did not integrate into $EPIC_BRANCH (see $_logf)"
>       release_lock
>       # branch is pushed and safe; a human resolves the conflict. Treat as this-child failure.
>       return 1
>     fi
>   fi
>
>   if [ "$KEEP_WORKTREES" -ne 1 ]; then
>     git worktree remove --force "$_wt" >/dev/null 2>&1 || rm -rf "$_wt"
>   fi
>   return 0
> ```
> Notes:
> - `reset --hard origin/$EPIC_BRANCH` inside the lock pulls in any prior child's merge so
>   children **accumulate** on the epic branch. The merge commit marker `#$_issue` is how the
>   agent later detects "this child is integrated".
> - The child branch ref (`$_branch`) is visible to the shared object store, so
>   `git -C "$EPIC_WT" merge "$_branch"` resolves the local branch created by the child worktree.
>
> **1e. Initialize the new ledgers** next to the existing `: > "$WORKTREES_DIR/.failed"` /
> `.pushed` lines:
>
> ```sh
> : > "$WORKTREES_DIR/.merged"
> : > "$WORKTREES_DIR/.mergefail"
> ```
> And call `ensure_epic_branch` once **before** the fan-out `for _rec in "$@"` loop.
>
> **1f. Count merge-conflicts as failures and clean up the epic worktree.** Replace the final
> summary/exit block:
>
> ```sh
> failed=$(grep -c . "$WORKTREES_DIR/.failed" 2>/dev/null); failed=${failed:-0}
> mergefail=$(grep -c . "$WORKTREES_DIR/.mergefail" 2>/dev/null); mergefail=${mergefail:-0}
> pushed=$(grep -c . "$WORKTREES_DIR/.pushed" 2>/dev/null); pushed=${pushed:-0}
> merged=$(grep -c . "$WORKTREES_DIR/.merged" 2>/dev/null); merged=${merged:-0}
> total_fail=$((failed + mergefail))
> if [ -n "$EPIC_BRANCH" ] && [ "$KEEP_WORKTREES" -ne 1 ]; then
>   git worktree remove --force "$EPIC_WT" >/dev/null 2>&1 || rm -rf "$EPIC_WT"
> fi
> log "wave complete: $pushed pushed, $merged merged, $failed failed, $mergefail merge-conflict."
> [ "$total_fail" -gt 0 ] && log "not integrated: $(tr '\n' ' ' < "$WORKTREES_DIR/.failed") $(tr '\n' ' ' < "$WORKTREES_DIR/.mergefail")"
> exit "$total_fail"
> ```
> Update the script's header comment block (lines ~10–13) to describe the epic-branch merge and
> the `--epic` flag.

---

> **Step 2 — Rewrite `/execute-epic` to auto-advance waves via the epic integration branch**
>
> - **File:** `.agents/commands/execute-epic.md`
> - **Action:** MODIFY
> - **Why:** The command must stop opening per-child PRs / stopping at a checkpoint, and instead
>   loop every runnable wave (children now land on the epic branch automatically) and open one
>   final `epic → main` PR.
>
> Rewrite the Instructions section as follows (keep steps 1–4 essentially as-is, replace 5–9):
>
> - **1 — Parse owner/repo and current branch.** Unchanged.
> - **2 — Resolve the epic.** Unchanged (`issue-resolution.md`).
> - **3 — Find the epic plan / reconstruct the graph.** Unchanged.
> - **4 — Compute waves (Kahn leveling).** Unchanged; apply the cycle guard.
> - **5 — Derive the integration branch.** Compute
>   `EPIC_BRANCH = epic/<epic#>-<kebab-slug-of-epic-title>` (strip a leading `epic:` from the
>   title; kebab-case the rest; keep it under ~50 chars). This is derived from the **epic
>   issue**, independent of the branch the user invoked from. State it explicitly in the plan
>   display.
> - **6 — Determine per-child status against the epic branch.** For each child, classify:
>   - **done** — the epic branch already contains its merge. Detect via
>     `mcp__github__list_commits { owner, repo, sha: "<EPIC_BRANCH>", per_page: 100 }` and match
>     a commit whose message contains `Merge child #<child>`. If the call 404s (epic branch does
>     not exist yet), treat **all** children as not-done.
>   - **failed/conflict (this session)** — appears in `.worktrees/.mergefail` or `.worktrees/.failed`
>     after a run (used during the loop, Step 8).
>   - **pending** — otherwise.
> - **7 — Confirm.** Unless `$ARGUMENTS` contains `skip confirm`, print and wait for
>   confirmation: epic title/number, the **integration branch** name, the full wave plan
>   (marking done/pending per child), the `AGENT_EXEC_CMD`, `PARALLEL_MAX_CONCURRENCY`, and any
>   warnings. If `$ARGUMENTS` contains `dry-run`, stop here after printing.
> - **8 — Wave loop (auto-advance; the core change).** Repeat until no progress:
>   1. Compute the **frontier** = pending children whose **every** dependency is **done** (on
>      the epic branch).
>   2. If the frontier is empty **and** pending children remain, their deps failed/conflicted →
>      report which children are blocked and why, then break the loop.
>   3. If the frontier is empty **and** no pending children remain → epic is complete → go to
>      Step 9.
>   4. Invoke the runner **once** for the frontier, passing `--epic`:
>      ```sh
>      sh .agents/scripts/run-parallel-issues.sh --epic <EPIC_BRANCH> \
>        "<issue>:<branch>:<title>" "<issue>:<branch>:<title>" ...
>      ```
>      Wait for it to finish.
>   5. Read `.worktrees/.merged` (integrated), `.worktrees/.mergefail` (conflict — branch pushed
>      but not integrated), `.worktrees/.failed` (agent/worktree failure).
>   6. **For each merged child:** post a ship-note comment to the child issue
>      (`mcp__github__add_issue_comment`, mirroring `/ship-note`: Summary, Files changed from
>      `.worktrees/<branch>.log`, Validation, and the `#<child> → <EPIC_BRANCH>` integration
>      reference), then tick the epic task-list item (`mcp__github__issue_write` `method:"update"`,
>      `- [ ] #<child>` → `- [x] #<child>`, preserving the rest of the body). Mark the child
>      **done** in local state.
>   7. **For each mergefail/failed child:** post a failure comment
>      (`mcp__github__add_issue_comment`) noting the cause (agent exit, or a merge conflict with
>      `<EPIC_BRANCH>`) and that `.worktrees/<branch>.log` is retained. **Do not** tick the
>      task-list. Its dependents stay blocked.
>   8. If this iteration merged **zero** children, break (no-progress guard) to avoid looping
>      forever. Bound the loop to at most the number of waves.
> - **9 — Open the single epic PR and post the final summary.**
>   - If **all** children are done: ensure a PR exists for the epic branch —
>     `mcp__github__list_pull_requests { head:"<owner>:<EPIC_BRANCH>", state:"all" }`; if none,
>     `mcp__github__create_pull_request { owner, repo, head:"<EPIC_BRANCH>", base:"main",
>     title:"<epic title>", body:"Closes #<epic>\n\nIntegrates all child issues:\n<child table>" }`.
>   - Post a final summary comment on the epic (`mcp__github__add_issue_comment`) with the
>     child → status table and the epic PR URL.
>   - If some children failed/conflicted: **do not** open the epic PR; report the blocked set
>     and stop (re-running `/execute-epic` after the human fixes the conflict is idempotent —
>     already-merged children are detected as done in Step 6).
>
> Rewrite the **Rules** block at the bottom accordingly: remove "open one PR per child",
> "manual merge checkpoint", and "two-wave runs require a manual checkpoint"; add "the runner
> integrates each child into the epic branch; the agent never merges", "waves auto-advance in a
> single run", "one `epic → main` PR at completion", and "re-running is idempotent — done
> children are detected from the epic branch".

---

> **Step 3 — Update the orchestration rule**
>
> - **File:** `.agents/rules/parallel-orchestration.md`
> - **Action:** MODIFY
> - **Why:** This rule is the canonical contract the commands cite; it must describe the new
>   model exactly.
> - **Details:**
>   - **New subsection "Epic Integration Branch":** each epic has a real branch
>     `epic/<epic#>-<slug>`, cut from `main`. Children branch off it and are **merged back into
>     it automatically by the runner** (the runner is its single writer via a `.merge.lock`).
>     `main` receives the epic only through the final `epic → main` PR.
>   - **Branch Naming:** change the epic branch from `epic/<slug>` to `epic/<epic#>-<slug>`
>     (numeric prefix → resolves via `issue-resolution.md` precedence #1, not fuzzy match).
>   - **Runner Contract:** document the new **first argument** `--epic <branch>` (optional; when
>     present, children cut from and merge into it); new outputs `.worktrees/.merged`
>     (`<issue> <branch>` per integrated child) and `.worktrees/.mergefail` (`<issue>` per
>     conflict); exit code = `failed + mergefail`. Note the single-writer lock and that a
>     merge-conflict child stays pushed (branch preserved) but not integrated.
>   - **Wave / Frontier Algorithm:** redefine **done** = "child's merge commit present on the
>     epic branch" (detected via `mcp__github__list_commits { sha:<epic branch> }`), replacing
>     "merged PR into main". The frontier = pending children whose deps are all done. Note the
>     agent now **loops all runnable waves in one invocation**.
>   - Replace the **"Manual-Merge Checkpoint Model"** section with an **"Auto-Merge Integration
>     Model"** section describing the above. Move the old manual-checkpoint behavior into the
>     **"Documented opt-ins (NOT built)"** list (alongside `--stacked`), as `--per-wave` (stop
>     after each wave for manual PR review) — describe the trade-off, do not build it.
>   - **Safety & Cleanup table:** add `EPIC_MERGE_FLAGS` (default `--no-ff`), the `.merge.lock`
>     serialization, and merge-conflict handling (branch retained, child flagged, dependents
>     blocked, re-run idempotent).

---

> **Step 4 — Update `issue-resolution.md` epic-branch note**
>
> - **File:** `.agents/rules/issue-resolution.md`
> - **Action:** MODIFY
> - **Details:** In "Epic and child branch shapes", change the epic-branch line from
>   `epic/<slug>` (resolved by fuzzy match) to `epic/<epic#>-<slug>` (resolved by the leading
>   numeric segment, precedence #1) and note this is the integration branch the runner writes to.
> - **Why:** Keeps the resolution rule consistent with the new deterministic epic-branch name.

---

> **Step 5 — Update the config example and the local config comments**
>
> - **Files:** `.agents/parallel.config.example`, `.agents/parallel.config`
> - **Action:** MODIFY
> - **Details:**
>   - Re-comment `BASE_BRANCH`: "the branch the epic integration branch is cut from (children
>     branch off the epic branch, not directly off this)".
>   - Add a comment: `# EPIC_BRANCH is passed per-run by /execute-epic via '--epic <branch>'; not set here.`
>   - Add `EPIC_MERGE_FLAGS="--no-ff"` with a comment ("how each child merges into the epic
>     branch; --no-ff keeps child boundaries for clean revert").
> - **Why:** Documents the new runner surface without moving per-epic dynamic state into static
>   config.

---

> **Step 6 — Update `AGENTS.md` "Parallel Orchestration" wave-flow paragraph**
>
> - **File:** `AGENTS.md`
> - **Action:** MODIFY
> - **Details:** Replace the **Wave flow** bullet (currently: "`/execute-epic` runs the current
>   frontier … opens PRs (`Closes #<child>`) … then **stops** asking you to merge this wave's
>   PRs before the next wave") with the auto-merge description: "`/execute-epic` creates an epic
>   integration branch `epic/<epic#>-<slug>`, runs each runnable wave in turn, and the runner
>   **auto-merges each child branch into the epic branch** — waves advance with no manual merge.
>   At completion it opens a single `epic → main` PR. Re-running is idempotent (done children are
>   detected from the epic branch)." Adjust the surrounding "Manual-Merge Checkpoint" wording if
>   present.
> - **Why:** `AGENTS.md` is the top-level cross-agent contract; it must not still describe the
>   manual checkpoint.

---

> **Step 7 — Update `/spec` Phase 3 wording**
>
> - **File:** `.agents/commands/spec.md`
> - **Action:** MODIFY
> - **Details:** In Phase 3 and Rules, remove "Stop at the merge checkpoint"; replace with
>   "follow `execute-epic.md`, which auto-advances all waves and opens one `epic → main` PR at
>   completion". Keep the mandatory Phase-2 review pause.
> - **Why:** `/spec` delegates to `/execute-epic`; its description must match the new behavior.

---

> **Step 8 — Record the integration branch in `/spec-breakdown`'s epic plan**
>
> - **File:** `.agents/commands/spec-breakdown.md`
> - **Action:** MODIFY
> - **Details:** In the epic plan template (step 8), add a header line
>   `> Integration branch: epic/<epic#>-<slug>` under `> Issue: #<epic>` (note `<epic#>` is
>   known after step 5; `<slug>` from the epic title). Mention in step 9's report that
>   `/execute-epic` will create/advance this branch.
> - **Why:** Gives `/execute-epic` a durable, machine-readable integration-branch name and keeps
>   the two dependency sources (plan file + GitHub) complete.

---

> **Step 9 — Update the Claude/OpenCode wrappers**
>
> - **Files:** `.claude/commands/execute-epic.md`, `.opencode/commands/execute-epic.md`,
>   `.claude/commands/spec.md`, `.opencode/commands/spec.md`
> - **Action:** MODIFY
> - **Details:**
>   - Claude `execute-epic.md`: add `mcp__github__list_commits` to `allowed-tools` (frontier/
>     done detection); the runner call with `--epic` still matches the existing
>     `Bash(sh .agents/scripts/run-parallel-issues.sh:*)` entry. Update `description` from
>     "then open PRs" → "then open one epic PR".
>   - Claude `spec.md`: add `mcp__github__list_commits` to `allowed-tools` (it runs execute-epic).
>   - OpenCode wrappers: **bodies stay identical** to the Claude wrappers; update only
>     `description` for parity. (OpenCode permissions are agent-level, so no `allowed-tools`.)
> - **Why:** The new agent-side detection uses `list_commits`; wrappers must pre-approve it
>   (Claude) and keep cross-agent body parity.

---

> **Step 10 — Mirror every edit into `custom-init.md`'s embedded templates**
>
> - **File:** `.agents/commands/custom-init.md`
> - **Action:** MODIFY
> - **Details:** This file embeds verbatim template copies of the changed files. Apply the
>   **same** edits to each embedded block so a freshly scaffolded project gets the new model:
>   - Runner block (starts ~line 1693, `### File: .agents/scripts/run-parallel-issues.sh`) →
>     mirror Step 1.
>   - Rule block (~line 1463, `### File: .agents/rules/parallel-orchestration.md`) → mirror Step 3.
>   - `execute-epic.md` block (~line 2073) → mirror Step 2.
>   - `spec.md` block (~line 2240) → mirror Step 7.
>   - `spec-breakdown.md` block (~line 1945) → mirror Step 8.
>   - Config block (~line 1880) → mirror Step 5.
>   - The `AGENTS.md` "Parallel Orchestration" section template (~lines 743–827) → mirror Step 6,
>     plus the epic-branch shape note (~line 827) → mirror Step 4.
>   - Wrapper `allowed-tools` blocks (~lines 2301, 2325) → mirror Step 9.
> - **Why:** `custom-init.md` is the scaffold source of truth for new projects; leaving it on
>   the old model would regress every project bootstrapped after this change. (If the team
>   prefers, this step can be deferred to a follow-up — see Open Questions — but the plan's
>   default is to keep the mirror in sync.)

---

> **Step 11 — Verify**
>
> - **Action:** run the checks in Validation Criteria below.

## Architecture Decisions

- **Runner is the single writer of the epic branch (local git), not the agent (MCP).** This
  respects the existing hard boundary (runner = git-only, GitHub-blind; agent = GitHub-only),
  avoids a GitHub round-trip per merge, and lets waves advance purely through git. The agent
  only *reads* epic-branch state (`list_commits`) and opens the final PR.
- **`--epic <branch>` positional flag, not an `EPIC_BRANCH=…` env prefix.** Keeps the runner
  invocation starting with `sh .agents/scripts/run-parallel-issues.sh …` so the Claude wrapper's
  `Bash(sh .agents/scripts/run-parallel-issues.sh:*)` allow-pattern still matches (no new
  permission prompt). `EPIC_BRANCH` is still honored from the environment as a fallback.
- **Serialize merges with a `mkdir` lock + a dedicated `__epic__` worktree.** Same-wave children
  are independent (Kahn leveling), but two `git merge`+`push` on one branch must not race;
  `mkdir` is atomic and POSIX-portable (matches the script's dash-safe style — no `flock`).
- **`--no-ff` merge commits (configurable via `EPIC_MERGE_FLAGS`).** Preserves per-child
  boundaries on the epic branch and gives a stable, greppable marker (`Merge child #<n>`) for
  done-detection and clean per-child revert. Squash/ff are opt-in via config.
- **Epic branch `epic/<epic#>-<slug>` (numeric prefix).** Makes the branch resolve to the epic
  issue via `issue-resolution.md` precedence #1 (deterministic) instead of fuzzy title match,
  and gives `list_commits` a predictable ref.
- **Waves auto-advance in one `/execute-epic` run.** This is the whole point of the request
  ("el avance de las waves no dependen de mergeo manual"). The old per-wave manual checkpoint is
  demoted to a documented, unbuilt opt-in (`--per-wave`).
- **One `epic → main` PR at completion, no per-child PRs.** Directly answers "actualmente crea
  pull-request por cada issue". Per-child traceability is preserved through ship-note comments +
  epic task-list ticking. Human review shifts to the single integration PR.
- **Merge conflict = child failure, branch preserved.** A child that can't integrate is pushed
  (work not lost), flagged in `.mergefail`, its dependents stay blocked, and re-running after a
  manual resolution is idempotent. Fail-closed rather than force-merge.
- **`ubiquitous-language.md` untouched.** Orchestration is dev tooling, not app domain; the
  glossary rule scopes to app entities/states/processes.

## Validation Criteria

- [x] `pnpm check` passes (no app source changed, but run it to confirm nothing broke).
- [x] `sh -n .agents/scripts/run-parallel-issues.sh` — script parses (no syntax error).
      `shellcheck` is not installed on this machine, so that half of the check was skipped.
- [x] **Backward-compat:** verified in an isolated sandbox repo — running the runner
      **without** `--epic` cuts children off `BASE_BRANCH`, pushes them, and writes
      `.pushed`/`.failed` exactly as before; `.merged`/`.mergefail` are created empty.
- [x] **Dry runner smoke test:** in an isolated sandbox with a stub `AGENT_EXEC_CMD`, with
      `--epic epic/999-smoke` and two child records touching distinct files, confirmed: an
      `epic/999-smoke` branch is created off `main`, both child branches merge into it,
      `.merged` lists both, and `git log epic/999-smoke` shows two `Merge child #…` commits.
- [x] **Conflict path:** verified in an isolated sandbox — two child stubs that both rewrite
      the same existing line in the same file → the second lands in `.mergefail`, its branch is
      still pushed (confirmed via `git branch -r`), the epic branch contains only the first
      child's merge commit, runner exit code = 1.
- [x] `grep -rn 'manual merge checkpoint\|one PR per child\|Closes #<child>'` across `.agents`,
      `.claude`, `.opencode`, `AGENTS.md` returns no hits describing the old model (the only
      matches are the new "no manual merge checkpoint" phrasing in `spec.md` and its
      `custom-init.md` mirror, describing the new model, not the old one).
- [x] `custom-init.md` embedded copies match the live files — diffed all seven touched blocks
      (`parallel-orchestration.md`, `issue-resolution.md`, `run-parallel-issues.sh`,
      `parallel.config.example`, `spec-breakdown.md`, `execute-epic.md`, `spec.md`) plus the
      `AGENTS.md` Slash Commands/Parallel Orchestration sections and the wrapper
      `allowed-tools`/`description` blocks; all byte-identical to their live counterparts.
- [x] Claude `execute-epic`/`spec` wrappers list `mcp__github__list_commits` in `allowed-tools`;
      OpenCode wrapper bodies are byte-identical to the Claude ones (frontmatter aside).
- [ ] End-to-end (optional, needs a real throwaway epic): `/spec` on a tiny 3-slice spec runs
      wave 1 → auto-merges → wave 2 (deps satisfied) → auto-merges → opens exactly **one**
      `epic → main` PR, with **zero** manual merge steps. Not run — requires a real GitHub
      round-trip; the sandbox smoke tests above cover the runner's local-git behavior that this
      would exercise.

## Open Questions

The plan is executable with the defaults below; these are review-time confirmations, not
blockers:

1. **Auto-advance all waves in one run** (default) vs. keep a per-wave stop as the built-in
   behavior? Default assumes the request means full auto-advance; `--per-wave` is documented but
   not built.
2. **One `epic → main` PR at completion** (default) — confirm we drop per-child PRs entirely
   (ship-notes + task-list ticking remain for traceability).
3. **On partial failure, hold the epic PR** (default) vs. open it with partial work and a
   "blocked children" note?
4. **`--no-ff` merge commits** (default) vs. squash or fast-forward for the child→epic merges?
5. **Update `custom-init.md` now** (default, Step 10) vs. defer the embedded-template sync to a
   follow-up task?
6. Should this ship under a **GitHub issue** (via `/create-issue`) so it has a tracked number,
   or land directly as a tooling change? (The `> Issue:` header is currently empty.)
