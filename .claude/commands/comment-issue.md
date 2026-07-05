---
description: Add a comment to the thread of the GitHub issue for the current branch
argument-hint: [comment text]
allowed-tools: Bash(git:*), mcp__github__list_issues, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__add_issue_comment
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Comment text: $ARGUMENTS

@.agents/commands/comment-issue.md
@.agents/rules/issue-resolution.md
