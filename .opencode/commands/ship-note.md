---
description: Post a ship-note of the executed work to the current branch's GitHub issue (does not close it)
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Overrides (optional): $ARGUMENTS

@.agents/commands/ship-note.md
@.agents/rules/issue-resolution.md
