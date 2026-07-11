# Rule: Resolve the GitHub Issue from the Current Branch

Shared by every issue-aware slash command (`/execute-issue`, `/update-issue`,
`/comment-issue`, `/ship-note`). Each of those commands must map
the **current branch** to exactly one existing GitHub **issue** (never a pull request) before
doing its work, using the precedence below.

## Context injected by the wrapper

- **Repository remote URL** — parse `owner` and `repo` from the injected
  `git remote get-url origin` output (supports HTTPS and SSH). GitHub redirects renamed repos,
  so the slug from the remote is always valid for the API.
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Precedence order

Stop at the first that yields a verified, existing **issue** (not a PR):

1. **Leading numeric segment** — strip a leading `user/` segment and any conventional-commit
   type prefix (`feat/`, `fix/`, `chore/`, `feat-`, `fix-`, `chore-`), then take the first bare
   numeric token (e.g. `15-nextjs-migration` → `15`). Verify with `mcp__github__issue_read` (`method: "get"`).
   Ignore numbers that are part of a Linear-style ID like `sdp-375` (letters-dash-number) —
   those are **not** GitHub issue numbers.
2. **Linked PR** — call `mcp__github__list_pull_requests` with `head: "<owner>:<branch>"` and
   `state: "all"`. If a PR matches the branch, read its body and parse the first
   `Closes|Fixes|Resolves #<n>` reference (case-insensitive). Verify that issue with
   `mcp__github__issue_read` (`method: "get"`).
3. **Title-slug fuzzy match** — derive a description slug from the branch by removing the
   `user/` prefix, any Linear-style `<team>-<number>-` prefix, and conventional-commit type
   tokens; replace `-`/`_` with spaces. Call `mcp__github__list_issues` (`state: "all"`,
   `per_page: 30`), **excluding entries that are pull requests** (those have a `pull_request`
   field or a `/pull/` html_url). Pick the issue whose title best matches the slug.
4. **Ask** — if nothing resolves confidently, list the open issues (number + title) and ask the
   user which one to use. Do not proceed without an answer.

## Epic and child branch shapes (from `/spec-breakdown`)

- **Child branches:** `<issue#>-<kebab-title>` (e.g. `12-keystroke-capture`). The leading
  numeric segment resolves these via precedence #1 above — no special handling required.
- **Epic branch:** `epic/<epic#>-<slug>` (e.g. `epic/55-orbit-111-v0`) — the epic
  **integration branch** the parallel runner writes to (`parallel-orchestration.md`).
  The leading numeric segment (after the `epic/` prefix) resolves it via precedence #1
  above, same as a child branch — deterministic, not a fuzzy title match. This note is
  informational; the resolution precedence is unchanged.

## Rules

- A Linear-style token (`sdp-375`) is **not** a GitHub issue number — never treat its digits as one.
- Resolve to an **issue**, never a pull request.
- When in doubt, ask — never guess an issue number for an outward-facing or destructive action.
