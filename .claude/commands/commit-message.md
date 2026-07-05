---
description: Generate a clear, professional commit message from the current changes (staged + unstaged)
argument-hint: [optional emphasis or scope]
allowed-tools: Bash(git diff:*)
disable-model-invocation: true
---

Staged changes:
!`git diff --cached`

Unstaged changes:
!`git diff`

Extra hint (optional): $ARGUMENTS

@.agents/commands/commit-message.md
