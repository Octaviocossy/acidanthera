# Rule: Architecture Decision Records

An **ADR** records a decision that outlives the work that produced it. Plan files
(`.agents/plans/`) and design specs (`.agents/specs/`) are per-task; an ADR is the durable,
cross-cutting store for decisions a future reader will need to understand the codebase.

ADRs are offered during a design interrogation (`design-interrogation.md`) and may be written
at any other point a qualifying decision is made.

---

## Location and numbering

```
.agents/adr/
├── 0001-<slug>.md
└── 0002-<slug>.md
```

- Sequential four-digit numbering. The next number is the highest existing number plus one —
  scan `.agents/adr/` to find it.
- The directory is created **lazily**. Do not create it, or an ADR, speculatively.

---

## When to offer an ADR

Offer one only when **all three** are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder "why on
   earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and one was picked for
   specific reasons.

If any of the three is missing, **skip it**. An easy-to-reverse decision will simply be
reversed. An unsurprising one leaves nobody wondering. One with no real alternative records
nothing beyond "we did the obvious thing."

Offer ADRs **sparingly**. A directory full of ADRs for routine choices is worth less than
three ADRs for the decisions that actually shaped the system.

### What qualifies

- **Architectural shape.** "The write model is event-sourced; the read model is projected."
- **Integration patterns between areas.** "These two modules communicate via events, not
  synchronous calls."
- **Technology choices carrying lock-in.** Database, message bus, auth provider, deployment
  target — not every library, just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** Who owns which data, and what other areas may not touch.
  The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "Manual SQL instead of an ORM, because X."
  Anything a reasonable reader would assume the opposite of. These stop the next engineer from
  "fixing" something that was intentional.
- **Constraints not visible in the code.** Compliance rules, partner API contracts, latency
  budgets imposed from outside.
- **Rejected alternatives when the rejection is non-obvious.** Otherwise the same suggestion
  comes back in six months.

A worked example from this repository: *children branch off the epic integration branch, never
off `main` directly* passes all three tests — expensive to change once an epic is in flight,
surprising to anyone expecting normal feature branches, and chosen over per-child PRs for
specific reasons.

---

## Format

```md
# {Short title of the decision}

{1–3 sentences: what's the context, what did we decide, and why.}
```

That is the whole template. An ADR can be a single paragraph. The value is in recording
**that** a decision was made and **why** — not in filling out sections.

### Optional sections

Include these only when they add genuine value. Most ADRs will not need any of them.

- **`Status` frontmatter** (`proposed | accepted | deprecated | superseded by ADR-NNNN`) —
  useful once decisions start being revisited.
- **Considered Options** — only when the rejected alternatives are worth remembering.
- **Consequences** — only when non-obvious downstream effects need calling out.

---

## Relationship to the other artifacts

| Artifact | Holds | Lifetime |
|----------|-------|----------|
| `.agents/specs/` | What was decided for *this* piece of work, and why | Per design interrogation |
| `.agents/plans/` | How to build it — steps, affected files, validation | Per task |
| `.agents/adr/` | Decisions that shape the system beyond one task | Durable |
| `.agents/ubiquitous-language.md` | Canonical terminology and invariants | Durable |

When a design interrogation raises an ADR, list it under `## ADRs Raised` in the design spec
so the decision is traceable back to the session that produced it.

---

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/adr.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` › Design Interrogation section |
