# Rule: Plan Creation & Persistence

When entering plan mode or creating an implementation plan, **always** save the plan as a markdown file in `.agents/plans/` so that any model (including less capable ones) can pick it up and execute it without ambiguity.

## Cross-Agent Compatibility

This file is the canonical source of truth for cross-agent planning in this repository.

- OpenCode enters this workflow through `AGENTS.md`.
- Claude enters this workflow through `CLAUDE.md` and `AGENTS.md`.

### Read-Only Plan Mode

If the active agent is in a read-only planning mode and cannot write files yet, it must still draft the full plan in-chat using the exact structure in this rule. The plan should then be saved to `.agents/plans/[yyyy-mm-dd]-[short-kebab-description].md` as soon as write access is available.

---

## When This Rule Applies

- You are asked to plan a feature, migration, refactor, or any non-trivial task
- You enter plan mode (`/plan` or equivalent)
- The user explicitly asks for a plan before implementation
- A task is complex enough that you would naturally break it into multiple steps

---

## File Location & Naming

```
.agents/plans/
└── [yyyy-mm-dd]-[short-kebab-description].md
```

Example: `.agents/plans/2026-03-17-add-user-profile-page.md`

- Use the current date as prefix for chronological ordering
- Use kebab-case for the description portion
- Keep the filename under 60 characters

---

## Required Plan Structure

Every plan file **must** include all of the following sections:

```markdown
# Plan: [Human-Readable Title]

> Status: **draft** | **approved** | **in-progress** | **completed** | **abandoned**
> Created: [YYYY-MM-DD]
> Updated: [YYYY-MM-DD]
> Issue: #N (optional — GitHub issue this plan implements)

## Goal

One or two sentences describing **what** we are building and **why**.

## Context

- What exists today (current state)
- What prompted this work (trigger)
- Any constraints, deadlines, or dependencies the implementer must know

## Affected Files

List **every** file that will be created, modified, or deleted. Use the full path from the project root. Mark each with its action:

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/features/[feature]/page.tsx` | Page orchestrator |
| MODIFY | `src/services/[service].ts` | Add new method |
| DELETE | `src/old-file.ts` | No longer needed |

## Step-by-Step Implementation

Number every step. Each step must be **atomic** (one clear action) and include:

1. **What to do** — the exact action (create file, add function, modify config, etc.)
2. **Where** — the full file path
3. **How** — the specific code or logic to write, in enough detail that a model with no prior context can implement it without guessing. Include:
   - Function signatures with parameter types and return types
   - Key logic or algorithm in pseudocode or actual code snippets
   - Imports that will be needed
   - Which existing patterns/files to reference as examples
4. **Why** — one sentence on the rationale (helps the implementer make judgment calls)

### Example step format:

> **Step 3 — Create the feature adapter**
>
> - **File:** `src/adapters/[feature].adapter.ts`
> - **Action:** CREATE
> - **Details:**
>   - Export a function `[feature]_adapter(rows: Record<string, string>[]): IFeature[]`
>   - Map each row using the `EFeatureConversion` enum for field names
>   - Reference `src/adapters/existing.adapter.ts` for the pattern
> - **Why:** Transforms raw data rows into typed domain objects

## Architecture Decisions

Document any non-obvious choices made during planning:

- Why a particular approach was chosen over alternatives
- Trade-offs accepted
- Patterns being followed (reference the rule file)

## Validation Criteria

How to verify the plan was implemented correctly:

- [ ] Specific acceptance checks
- [ ] Build passes
- [ ] Lint passes
- [ ] Manual smoke test steps if applicable

## Open Questions

List anything unresolved that needs user input before or during implementation. If none, write "None."
```

---

## Rules for Writing Plans

1. **Be exhaustive over concise** — another model will read this with zero context. Over-explain rather than assume knowledge.
2. **Include actual code snippets** for any non-trivial logic — interfaces, function signatures, config objects.
3. **Reference existing files as examples** — "follow the same pattern as `src/adapters/example.adapter.ts`" gives the implementer a concrete anchor.
4. **List every import** that a new file will need.
5. **Specify the order** — steps must be sequenced so that dependencies are created before dependents.
6. **No vague steps** — "set up the service" is not a valid step. "Create `src/services/foo.service.ts` exporting `foo_service.get(signal?: AbortSignal)`" is.
7. **Flag blockers** — if a step depends on user input, an env var, or an external action, call it out explicitly.
8. **Update the status** — when starting or completing the plan, update the `Status` field.

---

## Workflow

1. **Draft** — Create the plan file, present it to the user for review.
2. **Approve** — User confirms or requests changes. Update status to `approved`.
3. **Implement** — Execute steps in order. Update status to `in-progress`.
4. **Complete** — All validation criteria pass. Update status to `completed`.

If the plan is abandoned or superseded, update status to `abandoned` and note why.
