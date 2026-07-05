---
description: Execute the current branch's GitHub issue in two phases — confirm, then implement
argument-hint: [optional execution notes / overrides, e.g. "skip confirm"]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Execution notes / overrides (optional): $ARGUMENTS

@.agents/commands/execute-issue.md
@.agents/rules/issue-resolution.md
@.agents/rules/plan-creation.md
