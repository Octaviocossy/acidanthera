---
description: Hand this conversation off to a fresh background agent that picks up the work immediately
argument-hint: [what the next session should focus on; also "with-github" | "skip confirm"]
disable-model-invocation: true
allowed-tools: Bash(ls .agents/plans/:*), Bash(ls .agents/specs/:*), Bash(git:*), Bash(claude agents --json:*), Bash(claude --bg --name:*)
---

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Working tree (the child inherits this exact state):
!`git status --short`

Recent commits (cite these by SHA — do not re-describe them):
!`git log --oneline -5`

Persisted plans:
!`ls .agents/plans/ 2>/dev/null`

Settled design specs:
!`ls .agents/specs/ 2>/dev/null`

Agents already running (ignore the "interactive" entry — that is this session):
!`claude agents --json 2>/dev/null`

What the next session will focus on (optional): $ARGUMENTS

@.agents/commands/handoff.md
@.agents/rules/issue-resolution.md
