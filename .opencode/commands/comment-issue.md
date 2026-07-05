---
description: Add a comment to the thread of the GitHub issue for the current branch
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Comment text: $ARGUMENTS

@.agents/commands/comment-issue.md
@.agents/rules/issue-resolution.md
