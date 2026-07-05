---
description: Correct the body (and optionally the title) of the current branch's GitHub issue
argument-hint: [correction instructions]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Correction instructions: $ARGUMENTS

@.agents/commands/update-issue.md
@.agents/rules/issue-resolution.md
