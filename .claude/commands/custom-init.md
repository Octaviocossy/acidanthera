---
description: Bootstrap the cross-agent governance scaffold in a target project directory
argument-hint: "[target-dir] (optional, defaults to the current directory)"
allowed-tools: Bash(sh .agents/scripts/init-scaffold.sh:*)
disable-model-invocation: true
---

Target directory (optional): $ARGUMENTS

@.agents/commands/custom-init.md
