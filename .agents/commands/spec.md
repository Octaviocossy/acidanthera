# Command: spec

One-shot pipeline: decompose a large spec into an epic + child issues, pause for
human review, then auto-advance every wave into the epic integration branch. This
command **chains** `/spec-breakdown` and, for Phase 3, either `/execute-epic` or
`/supervise-epic`; it does not duplicate their logic.

`$ARGUMENTS` — spec text or path to a spec file, optionally followed by the
`--supervised` flag (passed through to `/spec-breakdown` after the flag is
stripped — see Phase 0).

## Context injected by the wrapper

- **Repository remote URL** — from `git remote get-url origin`
- **Current branch** — from `git rev-parse --abbrev-ref HEAD`

## Instructions

### Phase 0 — Parse arguments

`$ARGUMENTS` may contain the flag `--supervised`, anywhere in the string, surrounded
by whitespace. If present, strip it and set `EXECUTION = supervised`; otherwise
`EXECUTION = auto` (the default — unattended execution behind the agentic review
alone, same as calling `/execute-epic` directly). The remainder, trimmed, is the spec
input carried into Phase 1 — untouched otherwise, so a file path or free-form spec
text still passes through exactly as typed.

### Phase 1 — Breakdown

Follow `.agents/commands/spec-breakdown.md` exactly, passing the spec input from
Phase 0 as the spec argument. Complete all nine steps (ingest → decompose → create
epic → create children → update epic → persist plan → report).

### Phase 2 — Review pause

Present the created epic URL, all child issue URLs and branches, the computed waves,
and which execution path Phase 3 will use (`EXECUTION` from Phase 0). Then **stop and
ask the user** to confirm the decomposition before proceeding.

The user may:
- **Approve** → proceed to Phase 3.
- **Request changes** → edit the epic/child issues or re-run `/spec-breakdown` with a
  revised spec; do not proceed.
- **Cancel** → stop.

Do not auto-proceed. A pause here is mandatory.

### Phase 3 — Execute

Once the user approves, follow `.agents/commands/execute-epic.md` on the epic just
created — unless Phase 0 set `EXECUTION = supervised`, in which case follow
`.agents/commands/supervise-epic.md` instead. Either way, the `skip confirm` flag is
implicit (the review pause in Phase 2 served that purpose); do not ask for another
confirmation before the wave loop starts. On the supervised path this does **not**
skip the per-child review gate (`skip confirm` only ever skips the plan-display
confirmation, never the human decision per child) — you will still be asked to
approve or reject each child as it comes up for review.

Execute through the final step of whichever command Phase 3 selected, which
auto-advances all runnable waves in one run — every child passes push → agentic
review → optional rework → integrate before it lands on the epic branch, and the
command opens one `epic → main` PR at completion.

## Rules

- Phases 1 and 3 delegate entirely to their canonical specs; do not duplicate logic.
- The pause in Phase 2 is mandatory — never auto-proceed to execution.
- `EXECUTION` defaults to `auto` (`/execute-epic`); only an explicit `--supervised` at
  the call site routes Phase 3 to `/supervise-epic`. `/spec` never infers this from
  context — the opt-in must be visible in what the user typed.
- If Phase 1 fails (fewer than 3 slices, duplicate epic, etc.), stop and report;
  do not attempt Phase 3.
