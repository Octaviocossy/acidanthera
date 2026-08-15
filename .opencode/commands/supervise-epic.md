---
description: Execute an epic's child issues behind a human review gate — approve/reject each child before it integrates into the epic branch, then open one epic PR
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Options (optional): $ARGUMENTS

@.agents/commands/supervise-epic.md
@.agents/rules/issue-resolution.md
@.agents/rules/parallel-orchestration.md
