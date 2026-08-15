---
description: Execute an epic's child issues behind a human review gate — approve/reject each child before it integrates into the epic branch, then open one epic PR
argument-hint: [optional: "skip confirm" | "dry-run"]
disable-model-invocation: true
allowed-tools: Bash(git:*), Bash(sh .agents/scripts/run-parallel-issues.sh:*), mcp__github__issue_read, mcp__github__list_issues, mcp__github__list_pull_requests, mcp__github__list_commits, mcp__github__create_pull_request, mcp__github__add_issue_comment, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Options (optional): $ARGUMENTS

@.agents/commands/supervise-epic.md
@.agents/rules/issue-resolution.md
@.agents/rules/parallel-orchestration.md
