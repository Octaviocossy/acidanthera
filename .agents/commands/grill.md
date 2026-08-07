# Command: grill

Interrogate the user relentlessly about a design until every decision is settled, sharpening
the domain glossary and raising ADRs as you go. Ends by writing a **design spec** to
`.agents/specs/` and routing the user to the right implementation command.

This command settles the *what* and the *why*. It writes no implementation code and produces
no plan — that is `/planning`, `/create-issue`, or `/spec-breakdown`, whichever the routing
step names.

`$ARGUMENTS` — the topic to grill, **or** a path to a rough spec / notes file to grill
against. If empty, ask the user for one and stop.

## Context injected by the wrapper

- **Existing ADRs** — the injected `ls .agents/adr/` output, used to compute the next ADR
  number without a tool call. Empty or absent means no ADRs exist yet.
- **Current branch** — the injected `git rev-parse --abbrev-ref HEAD` output.

## Instructions

### 1 — Ingest

If `$ARGUMENTS` is a path that exists in the working tree, read it. Otherwise treat
`$ARGUMENTS` as the topic text. If `$ARGUMENTS` is empty, ask the user what to grill and stop
until they answer.

### 2 — Orient before asking anything

Read `.agents/ubiquitous-language.md` and `AGENTS.md`. Note the existing ADR numbers from the
injected listing.

Dispatch `Explore` sub-agents for any codebase facts needed to seed the design tree — what
already exists, which patterns are established, what a related module currently does.
**Do not ask the user anything that could be answered by looking.**

### 3 — Build the design tree

Decompose the topic into a tree of decisions per `.agents/rules/design-interrogation.md`:
every decision branches into the decisions that hang off it. Compute the initial frontier —
every decision whose prerequisites are already settled.

### 4 — Round loop

Repeat until the frontier is empty:

1. **Emit the whole frontier** as one round, in the fixed format:

   ```
   ❓ **Q1** - **<question title>**: <body>

   ➡️ <your recommended answer>
   ```

   Every question gets a recommendation. Number them sequentially across the whole session,
   not per round.

2. **Stop and wait.** Emitting a round ends the turn. Never answer your own questions, never
   assume an answer, never emit two rounds in one reply.

3. **On the user's answers**, run the four active-mode passes from
   `.agents/rules/domain-glossary.md`: challenge terms against the glossary, sharpen fuzzy
   language, stress-test relationships with concrete scenarios, and cross-reference claims
   against the real code.

4. **Write resolved terms into `.agents/ubiquitous-language.md` immediately** — inline, not
   batched. Bump `Last updated`, add a Changelog row.

5. **Offer an ADR** when a decision passes all three tests in `.agents/rules/adr.md` (hard to
   reverse, surprising without context, a real trade-off). Write it to
   `.agents/adr/NNNN-<slug>.md` only if the user accepts.

6. **Recompute the frontier** — settled decisions unblock questions that depended on them —
   and go to step 1.

### 5 — Terminate

When the frontier is empty, summarize the settled design tree and ask the user to confirm
shared understanding. **Do not write the spec before they confirm.**

### 6 — Write the design spec

Write `.agents/specs/[yyyy-mm-dd]-[short-kebab-slug].md` using the Design Spec File Format in
`.agents/rules/design-interrogation.md`: Goal, Settled Decisions table, Explicitly Out of
Scope, Glossary Changes, ADRs Raised, Residual Unknowns.

Keep the filename under 60 characters, matching the convention in `plan-creation.md`.

### 7 — Route

Name the next command and the exact invocation, per the routing table in
`.agents/rules/design-interrogation.md`:

- Local work, untracked → `/planning`
- One GitHub issue → `/create-issue`, then branch, `/execute-issue`, `/ship-note`
- 3–8 slices → `/spec-breakdown <spec path>`, then `/execute-epic` (or `/spec`)

Report the spec path, the glossary terms changed, any ADRs written, and the recommended
next invocation in full so the user can paste it.

## Rules

- **Never answer your own questions.** Emitting a round ends the turn — wait for the user.
- **Never batch rounds.** One frontier per reply.
- **Facts are yours, decisions are theirs.** Dispatch sub-agents for anything lookup-able;
  put every decision to the user. Invoking `/grill` is the user's authorization to dispatch
  sub-agents for fact-finding.
- **Ask the whole frontier**, not one question at a time. A question that depends on another
  still-open question belongs to a later round.
- **Every question carries a recommendation.**
- **Glossary writes are inline**, the moment a term resolves — never deferred to the end.
- **ADRs only on the three-part test.** When in doubt, skip it.
- **Write no implementation code and touch no production files** — the same boundary as
  `/planning`. The only files this command writes are the design spec, the glossary, and
  accepted ADRs.
- **Never run in a headless parallel-runner child** — there is no human to answer.
- Do not close, comment on, or otherwise touch GitHub. Routing hands off to a command that
  does that.
