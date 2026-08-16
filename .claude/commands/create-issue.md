---
description: Create a GitHub issue with a full implementation plan from a requirement description
argument-hint: [requirement description]
allowed-tools: Bash(git:*), Bash(gh label:*), mcp__github__list_issues, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Requirement: $ARGUMENTS

@.agents/commands/create-issue.md
@.agents/rules/plan-creation.md
