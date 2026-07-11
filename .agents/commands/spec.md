# Command: spec

One-shot pipeline: decompose a large spec into an epic + child issues, pause for
human review, then auto-advance every wave into the epic integration branch. This
command **chains** `/spec-breakdown` and `/execute-epic`; it does not duplicate their
logic.

`$ARGUMENTS` — spec text or path to a spec file (passed through to `/spec-breakdown`).

## Context injected by the wrapper

- **Repository remote URL** — from `git remote get-url origin`
- **Current branch** — from `git rev-parse --abbrev-ref HEAD`

## Instructions

### Phase 1 — Breakdown

Follow `.agents/commands/spec-breakdown.md` exactly, passing `$ARGUMENTS` as the
spec input. Complete all nine steps (ingest → decompose → create epic → create
children → update epic → persist plan → report).

### Phase 2 — Review pause

Present the created epic URL, all child issue URLs and branches, and the computed
waves. Then **stop and ask the user** to confirm the decomposition before proceeding.

The user may:
- **Approve** → proceed to Phase 3.
- **Request changes** → edit the epic/child issues or re-run `/spec-breakdown` with a
  revised spec; do not proceed.
- **Cancel** → stop.

Do not auto-proceed. A pause here is mandatory.

### Phase 3 — Execute

Once the user approves, follow `.agents/commands/execute-epic.md` on the epic just
created. The `skip confirm` flag is implicit (the review pause in Phase 2 served that
purpose); do not ask for another confirmation.

Execute through step 9 of `execute-epic.md`, which auto-advances all runnable waves in
one run (the runner merges each child into the epic integration branch as it lands —
no manual merge checkpoint) and opens one `epic → main` PR at completion.

## Rules

- Phases 1 and 3 delegate entirely to their canonical specs; do not duplicate logic.
- The pause in Phase 2 is mandatory — never auto-proceed to execution.
- If Phase 1 fails (fewer than 3 slices, duplicate epic, etc.), stop and report;
  do not attempt Phase 3.
