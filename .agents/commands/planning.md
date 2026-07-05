# Command: planning

Create a thorough implementation plan for a requested feature, migration, or refactor, and persist it in `.agents/plans/`.

## Purpose

This command produces a plan file that:
- Can be picked up by any model (including less capable ones) and executed without ambiguity
- Gives the user a reviewable artifact before any code is written
- Serves as a lightweight architectural decision record after implementation

## Instructions

When invoked with a task description:

1. **Inspect context** — read the relevant source files, rules, and existing plans to understand the current state. Do not skip this step even for seemingly simple tasks.
2. **Draft the plan** — produce a complete plan following `.agents/rules/plan-creation.md` exactly. Be exhaustive: another model will execute this with zero prior context.
3. **Save the plan** — write it to `.agents/plans/[yyyy-mm-dd]-[short-kebab-description].md` with status `draft`.
4. **Present for review** — respond with the file path and a concise summary. Do not implement until the user explicitly approves.

## Rules

- Do not edit any production files.
- Do not write any implementation code.
- Prefer small, incremental steps.
- Include every file likely to change, ordered by dependency.
- Include open questions only when they genuinely block execution.
- Follow the full plan structure defined in `.agents/rules/plan-creation.md`.
