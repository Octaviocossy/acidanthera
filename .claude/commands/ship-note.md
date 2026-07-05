---
description: Post a ship-note of the executed work to the current branch's GitHub issue (does not close it)
argument-hint: [optional overrides, e.g. "post-note in description"]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__add_issue_comment, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Overrides (optional): $ARGUMENTS

@.agents/commands/ship-note.md
@.agents/rules/issue-resolution.md
