# Command: execute-issue

Execute the implementation described in the **current branch's** GitHub issue, in three explicit
phases: **Confirmation → Execution → Review**. The issue body is the plan; this command carries
it out, then puts the result through the interactive review gate before calling it done. To
record the outcome afterwards, run `/ship-note`.

`$ARGUMENTS` is **optional** — extra execution notes or overrides, e.g. `skip confirm`
(auto-approve Phase 1) or `skip review` (bypass Phase 3).

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
   If the checks still fail after your fixes, **stop here** — report the failure with its
   output and do **not** enter Phase 3.
5. **Do not commit or push** unless the user explicitly asks (follow the global git guidance).
   This command edits the working tree only.

## Phase 3 — Review

**Goal:** the work is not done until a fresh reviewer has seen it.

1. Enter Phase 3 only if the Phase 2 acceptance checks **passed**. If they failed, stop and
   report — reviewing code the build already condemned spends context on findings nobody needs.
2. If `$ARGUMENTS` contains `skip review`, say so explicitly in the final report and go to
   step 4. This is the only way to finish an execution without a review.
3. Run the procedure in `.agents/commands/review-branch.md` with no fixed-point argument (it
   deduces one) and the default working-tree comparison form — this execution has committed
   nothing, so the three-dot form would review an empty diff (ADR-0025). Rework rounds, if any,
   happen here.
4. Once the review is approved, point the user to `/ship-note` to record what changed on the
   issue.

---

## Rules

- Three phases, in order. Never start Phase 2 without Phase 1 confirmation (unless
  `skip confirm`), and never call the work done without Phase 3 (unless `skip review`).
- The linked `.agents/plans/` file (if it exists) is the source of truth for *what* to build;
  fall back to the issue body when no plan is linked. Deviate only with reason and surface
  any deviation so `/ship-note` can record it.
- Execution must obey `AGENTS.md`, the relevant `.agents/rules/*`, and the ubiquitous language.
- Report failures faithfully — never claim done when build/lint failed or a step was skipped.
- **Work is not done until an agentic review has seen it.** Only `skip review` bypasses Phase 3,
  and using it must be stated in the final report. A failing acceptance run stops before the
  review rather than skipping it.
- Working-tree only: do not commit, push, change issue state/labels, or post to the issue.
- Recording the outcome is a separate step — run `/ship-note` after execution.
