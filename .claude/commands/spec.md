---
description: One-shot — break a spec into an epic + children, then execute them in parallel
argument-hint: [spec text OR path to a spec file]
allowed-tools: Bash(git:*), Bash(sh .agents/scripts/run-parallel-issues.sh:*), mcp__github__list_issues, mcp__github__issue_write, mcp__github__issue_read, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__add_issue_comment
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Spec (text or file path): $ARGUMENTS

@.agents/commands/spec.md
@.agents/rules/parallel-orchestration.md
@.agents/rules/plan-creation.md
@.agents/rules/issue-resolution.md
