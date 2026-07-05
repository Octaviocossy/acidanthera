# Command: ship-note

Record what actually happened on the GitHub issue that corresponds to the **current branch**,
once an execution (`/execute-issue`) is done. By default the ship-note is posted as a
**new issue comment**.

This command **does not close the issue** and never changes its state, title, or labels — it
only records the outcome. It **always posts** — no confirmation step. `$ARGUMENTS` is
**optional** — overrides such as `post-note in description` (append to the body instead of a comment).

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin` output (HTTPS or SSH).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

1. **Parse `owner`/`repo`** from the injected remote URL.
2. **Resolve the issue number from the current branch** using the precedence in
   `.agents/rules/issue-resolution.md` (numeric segment → linked PR → title-slug → ask). Fetch
   the issue with `mcp__github__issue_read` (`method: "get"`) for its `title` and (only if appending) its current `body`.
3. **Reconcile what actually changed** against reality — run `git status` and `git diff --stat`
   to list the files that were really created/modified/deleted. **Do not** copy the plan's
   Affected Files — report the real diff.
4. **Compose the ship-note** with this structure:

   ```
   ## Ship Note

   **Summary** — what was implemented, in 1–3 sentences.

   **Plan executed** — issue body, or path to the `.agents/plans/` file used.

   **Files changed**
   | Action | File Path | Notes |
   |--------|-----------|-------|
   | CREATE/MODIFY/DELETE | `path/from/root` | what changed |

   **Deviations from the plan** — where execution diverged from the Step-by-Step /
   Affected Files and why. If none, write "None — implemented as planned."

   **Validation** — project acceptance commands ✅/❌ (from `AGENTS.md` › Commands; e.g. `pnpm lint && pnpm build` or `xcodebuild … build`), plus any manual checks.

   **Follow-ups / Open Questions** — anything outstanding or deferred. If none, write "None."

   _Branch: `<current-branch>`. Recorded via `/ship-note`._
   ```

5. **Post the ship-note** — always post immediately; do **not** wait for confirmation.
   - **Default:** a new issue comment via `mcp__github__add_issue_comment`
     (`owner`, `repo`, `issue_number`, `body`).
   - **Override** (`post-note in description` or equivalent): append a `## Ship Note` section
     to the **bottom** of the issue body via `mcp__github__issue_write` (`method: "update"`; preserve the entire
     existing body — append only; send `body` only, never `state`/`title`/`labels`).
6. **Report** to the user: the issue URL, the comment URL (if a comment was posted), and a
   one-line outcome (succeeded / partially / blocked).

## Rules

- Resolve the issue from the branch using `.agents/rules/issue-resolution.md`, then **post immediately — no confirmation**.
- Reconcile the **Files changed** table against the real `git` diff — never just copy the plan.
- Report failures faithfully — if the project acceptance commands failed or a step was skipped, say so.
- **Never close the issue** or change its state, title, or labels. Default to a new comment; only
  append to the description when explicitly asked, and preserve the existing body verbatim.
- Never create a new issue. If the branch resolves to no issue and the user can't name one, stop.
