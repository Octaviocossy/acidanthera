---
description: Sync the cross-agent governance scaffold into a target project directory; updates what the scaffold owns and conflict-marks genuine divergence
argument-hint: "[target-dir] (optional, defaults to the current directory)"
allowed-tools: Bash(sh .agents/scripts/install-scaffold.sh:*)
disable-model-invocation: true
---

Target directory (optional): $ARGUMENTS

@.agents/commands/install-scaffold.md
