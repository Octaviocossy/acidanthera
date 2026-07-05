# Command: update-issue

Correct the body (and optionally the title) of the GitHub issue that corresponds to the
**current branch**, when the initial generation by `/create-issue` was inaccurate. Writes
to GitHub via `mcp__github__issue_write` (`method: "update"`).

Use this for **correcting generation errors** in the issue — wrong scope, bad file paths,
missing steps. For evolving the implementation plan during execution, edit the linked
`.agents/plans/` file directly instead.

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin` output (HTTPS or SSH).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

When invoked (`$ARGUMENTS` = the corrections to apply):

1. **Read the correction instructions** from `$ARGUMENTS`. If empty, ask the user what to
   correct and stop.
2. **Parse `owner`/`repo`** from the injected remote URL.
3. **Resolve the issue number from the current branch** using the precedence in
   `.agents/rules/issue-resolution.md` (numeric segment → linked PR → title-slug → ask).
   Fetch the issue with `mcp__github__issue_read` (`method: "get"`) to get its `title` and `body`.
4. **Apply the corrections surgically** to the body:
   - Edit only the sections the instructions touch; preserve everything else verbatim.
   - Keep the same section structure that `/create-issue` uses: Goal, Context, Affected
     Files, Step-by-Step Implementation, Architecture Decisions, Acceptance Criteria,
     Open Questions.
   - If the body already has a `## Ship Note` section at the bottom, **preserve it verbatim**
     and re-adjoin it at the bottom after the corrections.
   - If the instructions imply a title change, derive the corrected title (≤ 72 chars,
     Conventional Commits style); otherwise leave the title unchanged.
   - Inspect source files with Read/Bash when the corrections require accurate file paths,
     function signatures, or step details.
5. **Preview and confirm** — show the resolved issue (`#<number> — <title>`), the corrected
   body (and new title if changed), and wait for explicit confirmation before writing.
   Skip confirmation only if `$ARGUMENTS` says so (e.g. `no confirm`).
6. **Write the update** via `mcp__github__issue_write` (`method: "update"`) — always send `body`; send `title`
   only if it changed. Never send `state` or `labels`.
7. **Report** the issue URL to the user.

## Rules

- Resolve the issue from the branch using `.agents/rules/issue-resolution.md`.
- Corrections only — edit surgically, do not rewrite the whole body unless entirely wrong.
- Preserve any `## Ship Note` section at the bottom of the body.
- Preview + confirm before writing (default); `no confirm` skips the wait.
- Never change issue state, labels, or add comments. This command only updates body/title.
- If the branch resolves to no issue and the user can't name one, stop.
