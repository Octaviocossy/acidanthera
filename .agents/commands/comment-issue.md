# Command: comment-issue

Add a comment to the thread of the GitHub issue that corresponds to the **current branch**.
The comment text comes from `$ARGUMENTS`.

This command only **adds a comment**. It never edits the issue body, title, state, or labels.

## Context injected by the wrapper

The wrapper injects:
- **Repository remote URL** — parse `owner`/`repo` from the injected `git remote get-url origin` output (HTTPS or SSH; GitHub redirects renamed repos, so the slug is always valid).
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

1. **Read the comment text** from `$ARGUMENTS`. If empty, ask the user what to comment and stop
   (do not invent a comment).
2. **Parse `owner`/`repo`** from the injected remote URL.
3. **Resolve the issue number from the current branch** using the precedence in
   `.agents/rules/issue-resolution.md`: (1) leading numeric segment, (2) linked PR
   `Closes/Fixes/Resolves #N`, (3) title-slug fuzzy match against non-PR issues, (4) ask the
   user. A Linear-style token like `sdp-375` is **not** a GitHub issue number.
4. **Compose the comment body** from `$ARGUMENTS`:
   - Post the user's text **faithfully** — preserve meaning and wording.
   - Apply only **light Markdown cleanup** (e.g. wrap code in backticks, fix list formatting).
   - Do **not** add content, headers, sign-offs, or a footer the user didn't ask for.
5. **Preview and confirm** — show the resolved issue (`#<number> — <title>`) and the rendered
   comment, then wait for confirmation. A comment is public/outward-facing. Skip confirmation
   only if `$ARGUMENTS` says so (e.g. `no confirm`).
6. **Post the comment** with `mcp__github__add_issue_comment` (`owner`, `repo`, `issue_number`, `body`).
7. **Report** the issue URL (and comment URL if available) to the user.

## Rules

- Resolve the issue from the branch using the precedence above; **confirm before posting**.
- Comment-only — never touch the issue body, title, state, or labels.
- Stay faithful to the user's text; do not editorialize or pad it.
- If the branch resolves to no issue and the user can't name one, stop — never create an issue.
