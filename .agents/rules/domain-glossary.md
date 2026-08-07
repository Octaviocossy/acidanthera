# Rule: Domain Glossary Check

**Before touching any domain code you MUST read `.agents/ubiquitous-language.md`.**

## What counts as domain code

A file is domain code if it lives in a canonical domain path or names, exports, imports, or changes a glossary concept.

**Canonical domain code paths for this project:**
- `src/` (TS frontend)
- `src-tauri/src/` (Rust backend)

## What belongs in the glossary

Include concise definitions for canonical concepts, states, processes, data contracts, naming distinctions, and cross-slice invariants. Definitions describe current behavior only.

Do not include component inventories, styling retrospectives, service wrappers without naming ambiguity, exact caller or import graphs, or release chronology. Put historical and superseded behavior only in the glossary Changelog.

## What to verify before editing

1. **Entity name** — use the canonical term, not an alias to avoid.
2. **Canonical type** — confirm the correct interface, schema, or module.
3. **Naming distinction** — preserve any relevant ambiguity or invariant.
4. **Current behavior** — do not encode incidental implementation details as contracts.

## What to do after editing domain code

If you introduce or change canonical vocabulary or an invariant:
- Add it to `.agents/ubiquitous-language.md` under the correct section.
- Set `Last updated` to the current ISO date only; do not append a summary.
- Add a row to the Changelog table.

## Active mode (during a design interrogation)

Everything above is the **passive** discipline: read the glossary before touching domain code,
update it after. During a `/grill` session (`design-interrogation.md`) the same glossary is
worked **actively** — you are changing the model, not just consuming it. Four passes run
alongside the questioning:

1. **Challenge against the glossary.** When the user uses a term that conflicts with an
   existing definition, call it out immediately: "the glossary defines *cancellation* as X,
   but you seem to mean Y — which is it?"
2. **Sharpen fuzzy language.** When a term is vague or overloaded, propose a precise canonical
   one: "you're saying *account* — do you mean the Customer or the User? Those are different
   things."
3. **Stress-test with concrete scenarios.** When domain relationships are being discussed,
   invent specific edge cases that force precision about the boundaries between concepts.
   Abstract agreement hides disagreement; a scenario surfaces it.
4. **Cross-reference with code.** When the user states how something works, check whether the
   code agrees. Surface any contradiction: "the code cancels entire Orders, but you just said
   partial cancellation is possible — which is right?"

### Write inline, never batched

When a term resolves, update `.agents/ubiquitous-language.md` **right then** — do not
accumulate terms to write at the end of the session. Follow the same post-edit procedure as
above: add the term, set `Last updated` to the current ISO date, add a Changelog row.

### Keep the glossary a glossary

`.agents/ubiquitous-language.md` is a glossary and nothing else. It is not a spec, not a
scratchpad, and not a home for implementation decisions. During an interrogation:

- **Terminology** → the glossary.
- **Settled design decisions for this work** → the design spec (`design-interrogation.md`).
- **Decisions that outlive this work** → an ADR (`adr.md`).

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/domain-glossary.md` and `@.agents/ubiquitous-language.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` Domain section |
