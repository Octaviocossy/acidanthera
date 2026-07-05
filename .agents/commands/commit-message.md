# Command: commit-message

Generate a clear, professional commit message from the current repository changes.

## Source of changes

The wrapper injects the current diff — staged (`git diff --cached`) and unstaged
(`git diff`). Base the message on it, prioritizing staged over unstaged.

## Instructions

- Produce **a single commit message** that is clear, concise, and professional.
- Use **Conventional Commits** when appropriate: `type(scope): short description`
  (types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `ci`, `build`).
- Subject line (first line) **maximum 72 characters**.
- Add a body (what changed and why) only when the changes justify it; wrap body lines at ~72 chars.
- Prioritize staged changes; if nothing is staged, use the unstaged changes.
- If an extra hint or scope was provided, weight the message toward it.
- If there are no changes at all, reply that there is nothing to commit.
- use `'` instead of `"` in the commit message.
- Return **only the commit message** — no explanations, no surrounding prose, no code fences —
  ready to paste into `git commit`.
