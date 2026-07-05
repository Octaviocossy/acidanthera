---
description: Correct the body (and optionally the title) of the current branch's GitHub issue
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Correction instructions: $ARGUMENTS

@.agents/commands/update-issue.md
@.agents/rules/issue-resolution.md
