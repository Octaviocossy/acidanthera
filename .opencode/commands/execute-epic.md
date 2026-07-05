---
description: Execute an epic's child issues in parallel (one wave/frontier per run), then open PRs
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Options (optional): $ARGUMENTS

@.agents/commands/execute-epic.md
@.agents/rules/issue-resolution.md
@.agents/rules/parallel-orchestration.md
