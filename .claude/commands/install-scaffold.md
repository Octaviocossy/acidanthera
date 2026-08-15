---
description: Install the cross-agent governance scaffold into a target project directory; never overwrites, safe to re-run
argument-hint: "[target-dir] (optional, defaults to the current directory)"
allowed-tools: Bash(sh .agents/scripts/install-scaffold.sh:*)
disable-model-invocation: true
---

Target directory (optional): $ARGUMENTS

@.agents/commands/install-scaffold.md
