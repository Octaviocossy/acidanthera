---
description: One-shot — break a spec into an epic + children, then execute them in parallel (add --supervised to route execution through /supervise-epic instead of /execute-epic)
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Spec (text or file path, optionally with --supervised): $ARGUMENTS

@.agents/commands/spec.md
@.agents/rules/parallel-orchestration.md
@.agents/rules/plan-creation.md
@.agents/rules/issue-resolution.md
