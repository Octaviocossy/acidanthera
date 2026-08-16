---
description: Decompose a large spec into an epic issue + N child issues with a dependency graph
argument-hint: [spec text pasted inline, OR a path to a spec file you attach, e.g. ./spec.md]
allowed-tools: Bash(git:*), Bash(gh label:*), mcp__github__list_issues, mcp__github__issue_write
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Spec (text or file path): $ARGUMENTS

@.agents/commands/spec-breakdown.md
@.agents/rules/parallel-orchestration.md
@.agents/rules/plan-creation.md
