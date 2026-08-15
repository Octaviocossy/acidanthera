---
name: resolving-merge-conflicts
description: "Use when you need to resolve an in-progress git merge/rebase conflict."
---

1. **See the current state** of the merge/rebase. Check git history, and the conflicting files.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made,
   and what the original intent was. Read the commit messages, check the PRs, check original
   issues/tickets.

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one
   matching the merge's stated goal and note the trade-off. Do **not** invent new behaviour.
   Always resolve; never `--abort`.

4. Discover the project's **automated checks** and run them — typically typecheck, then tests,
   then format. Fix anything the merge broke.

5. **Finish the merge/rebase.** Stage everything and commit. If rebasing, continue the rebase
   process until all commits are rebased.

## In this repository

Grounding for the steps above. Everything else is unchanged.

**Step 2 — primary sources.** Resolve each side's branch to its GitHub issue using the
precedence in `.agents/rules/issue-resolution.md` (leading numeric segment → linked PR →
title-slug → ask). Read it with `mcp__github__issue_read` (`method: "get"`). If a
`.agents/plans/*.md` file carries that issue in its `> Issue: #N` header, that plan states the
intent better than the diff does. For an epic child, the `> Epic: #<n>` and `> Depends on: #…`
headers name the siblings whose work you are colliding with.

**Step 4 — automated checks.** Read `AGENTS.md` › `## Commands` for this project's build, test,
lint, type-check, and format commands, and honor `## Verification Quirks`. Any entry still
reading `_not yet documented_` has no runner yet — say so rather than inventing one. For changes
touching the scaffold itself, always run `sh .agents/scripts/verify-scaffold.sh` (exit status =
number of failed checks). If the conflict touches domain code, re-read
`.agents/ubiquitous-language.md` per `.agents/rules/domain-glossary.md` before resolving — a
merge is a common way for two branches to introduce competing names for one concept.

**Scope — the parallel runner is exempt.** `.agents/scripts/run-parallel-issues.sh` runs
`git merge --abort` when a child fails to integrate into the epic branch. That is deliberate,
not a violation of step 3: the runner is the epic branch's **single writer** and must never
leave it dirty or push a half-merge. It records the child in `.worktrees/.mergefail`, keeps the
child branch pushed, and retains the worktree and log for you.

The correct recovery is to resolve **in the child branch's direction**, so the runner's next
attempt is clean and the single-writer invariant holds:

1. `git -C .worktrees/<child-branch> merge origin/<epic-branch>` — reproduces the same conflict,
   with you on the child's side.
2. Resolve it with steps 1–5 above.
3. Push the child branch, then re-run `/execute-epic`. It is idempotent: already-integrated
   children are detected from the epic branch's commit history and skipped.

Never resolve by pushing directly to the epic integration branch.
