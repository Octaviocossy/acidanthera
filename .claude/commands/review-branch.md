---
description: Review the current branch's work on two axes and loop rework rounds until you approve
argument-hint: [optional: fixed point (branch/SHA) and/or "committed-only"]
disable-model-invocation: true
allowed-tools: Bash(git:*), Bash(gh issue view:*), Bash(sh .agents/scripts/build-corpus-pack.sh:*), Bash(sh .agents/scripts/run-review-agent.sh:*), mcp__github__issue_read, mcp__github__list_issues, mcp__github__list_pull_requests
---

Repository remote (parse owner/repo from this):
!`git remote get-url origin`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Options (optional): $ARGUMENTS

@.agents/commands/review-branch.md
@.agents/rules/issue-resolution.md
