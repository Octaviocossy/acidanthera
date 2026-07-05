---
description: Bootstrap the cross-agent governance scaffold in the current project
argument-hint: "(no arguments needed)"
allowed-tools: Bash(ls:*), Bash(find:*)
disable-model-invocation: true
---

Current directory:
!`ls -la`

Existing governance files:
!`find . -maxdepth 4 \( -name "CLAUDE.md" -o -name "AGENTS.md" -o -name ".agents" -o -name ".claude" -o -name ".opencode" \) 2>/dev/null | sort`

@.agents/commands/custom-init.md
