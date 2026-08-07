# Rule: Design Interrogation

This rule governs `/grill`. It defines the design-tree model, the frontier algorithm over
decisions, the round format, the fact/decision split, the termination condition, the design
spec file format, and the routing table that hands a settled spec to implementation.

The purpose is to settle a design **before** an artifact is written. Without it, `/planning`,
`/create-issue`, and `/spec-breakdown` each go from a one-line description straight to a
detailed artifact — silently guessing every unstated decision and deferring the residue to
`## Open Questions`.

---

## Design Tree

Model the problem as a **design tree**: every decision branches into the decisions that hang
off it. Choosing a storage engine unblocks questions about migrations and backups; those
questions do not exist until the first is settled.

The **frontier** is every decision whose prerequisites are already settled — the questions
that can be asked *now* without guessing at answers not yet heard.

This is the same frontier computation as `parallel-orchestration.md` (Wave / Frontier
Algorithm), applied to **decisions** instead of child issues. A question whose answer depends
on another question still open in this round belongs to a **later** round, not this one.

---

## Rounds

Work the tree in **rounds**. Ask the *whole* frontier in one round — never one question at a
time, never a subset. Each question is numbered and carries the agent's own recommended answer.

### Question format

Emit each question exactly like this:

```
❓ **Q1** - **<question title>**: <question body, may be multiple paragraphs, may include
multiple choices>

➡️ <your recommended answer>
```

The recommendation is mandatory. A question without one pushes work back onto the user that
the agent is better placed to do — the user should be able to reply "1, 3, agree with the
rest" and have that be a complete answer.

### Hard stop (invariant)

**After emitting a round, stop and wait for the user.** Do not:

- answer your own questions,
- proceed on an assumed answer,
- emit round 2 in the same reply as round 1,
- start implementing, planning, or writing the spec.

This is the single most likely failure mode of this rule. Emitting a round ends the turn.

### Advancing

Each round of answers reshapes the tree — settled decisions push the frontier outward and
unblock questions that depended on them. Recompute the frontier and ask the next round.

---

## Facts Versus Decisions

**Finding facts is the agent's job, never the user's.** When a frontier question needs a fact
from the environment — what a file contains, whether a pattern already exists, what a
dependency's API looks like — find it. Dispatch a sub-agent (`Explore` for codebase questions)
rather than asking the user something that could be looked up.

Do not block the round on a running lookup: an in-flight exploration is an unsettled
prerequisite, so only the questions *downstream* of it wait. Ask the rest of the frontier now.

**The decisions are the user's.** Put each one to them and wait. Never convert a decision into
an assumption because the answer seems obvious.

---

## Termination

The session is done when the frontier is empty — every branch of the design tree visited,
nothing left silently assumed.

Summarize the settled tree and ask the user to confirm shared understanding. **Do not act on
the design, and do not write the spec file, until they confirm.**

---

## Interactive-Only Boundary

A design interrogation requires a human to answer. It must **never** run inside a headless
parallel-runner child (`.agents/scripts/run-parallel-issues.sh`), where there is nobody to
respond and the agent would answer its own questions.

| Agent | Enforcement |
|-------|-------------|
| Claude Code | `disable-model-invocation: true` in `.claude/commands/grill.md` — user-invoked only |
| OpenCode | No equivalent frontmatter field; this rule is the enforcement |

---

## Design Spec File Format

The interrogation's output artifact. `/grill` writes it; `/planning`, `/create-issue`, and
`/spec-breakdown` read it. Persist to `.agents/specs/[yyyy-mm-dd]-[short-kebab-slug].md`.

```markdown
# Spec: <Title>

> Status: **settled**
> Created: [YYYY-MM-DD]
> Grilled: [YYYY-MM-DD] — N rounds, M decisions
> Suggested next: /spec-breakdown | /planning | /create-issue

## Goal

One or two sentences: what is being built and why.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | <the question that was asked> | <what was decided> | <why, in one line> |

## Explicitly Out of Scope

- <the things deliberately excluded>

## Glossary Changes

Terms added or sharpened in `.agents/ubiquitous-language.md` during this session. "None." if none.

## ADRs Raised

- `.agents/adr/NNNN-slug.md` — <title>

"None." if none.

## Residual Unknowns

Anything that could not be settled, and why. "None." if the frontier emptied cleanly.
```

Notes:

- The **Explicitly Out of Scope** section is not filler. The deliberate no-s stop a later
  implementer from "fixing" something that was decided against.
- A design spec is **not** a plan. It records *what* was decided and *why*; the *how*
  (step-by-step, affected files) belongs in a plan file per `plan-creation.md`.
- A design spec is **not** a glossary. Terminology goes in `.agents/ubiquitous-language.md`;
  architectural decisions that outlive this work go in an ADR per `adr.md`.

---

## Routing

By the time the frontier is empty, the scope is known. End the session by naming the next
command and the exact invocation, including the spec path.

| Scope | Next command |
|-------|--------------|
| Local work, not tracked on GitHub | `/planning` |
| A single GitHub issue | `/create-issue` → `git checkout -b <n>-<slug>` → `/execute-issue` → `/ship-note` |
| Large enough to split (3–8 slices) | `/spec-breakdown <spec path>` → `/execute-epic` (or `/spec`) |

Reuse the thresholds already set by `parallel-orchestration.md` (Decomposition Heuristics):
fewer than 3 slices → `/create-issue` instead of an epic; more than `MAX_CHILDREN` (default
12) → coarsen the spec first.

`/spec-breakdown` already accepts a path to a spec file as `$ARGUMENTS`, so the handoff needs
no special support:

```
/spec-breakdown .agents/specs/2026-08-06-offline-first-sync.md
```

---

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/design-interrogation.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` › Design Interrogation section |
