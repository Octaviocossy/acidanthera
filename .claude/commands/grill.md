---
description: Relentless design interrogation that sharpens a plan and writes the docs as it goes
argument-hint: [topic, question, or path to a rough spec]
disable-model-invocation: true
allowed-tools: Bash(ls .agents/adr/:*), Bash(git:*)
---

Existing ADRs (for numbering — empty means none yet):
!`ls .agents/adr/ 2>/dev/null`

Current branch:
!`git rev-parse --abbrev-ref HEAD`

Topic or path to grill: $ARGUMENTS

@.agents/commands/grill.md
@.agents/rules/design-interrogation.md
@.agents/rules/domain-glossary.md
@.agents/rules/adr.md
@.agents/ubiquitous-language.md
