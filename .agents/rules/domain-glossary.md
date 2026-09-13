# Rule: Domain Glossary Check

**Before touching any domain code you MUST read the glossary.** Look the term up in
`.agents/ubiquitous-language-index.md` — always in context — and read the family member it
points at (ADR-0016). The five files and their owners are listed in `AGENTS.md` › Domain.

## What counts as domain code

A file is domain code if it lives in a canonical domain path or names, exports, imports, or changes a glossary concept.

**Canonical domain code paths for this project:**
- `src/` (TS frontend)
- `src-tauri/src/` (Rust backend)

## What belongs in the glossary

Include concise definitions for canonical concepts, states, processes, data contracts, naming distinctions, and cross-slice invariants. Definitions describe current behavior only.

Do not include component inventories, styling retrospectives, service wrappers without naming ambiguity, exact caller or import graphs, or release chronology. Put historical and superseded behavior only in `.agents/ubiquitous-language-changelog.md`.

Every row obeys the **one-claim rule** and the **glossary budget**, and leaves by the **retirement test** —
defined in `.agents/ubiquitous-language-scaffold.md` › Glossary governance and enforced by
`.agents/scripts/verify-scaffold.sh` §12 (ADR-0018). Read that area before adding, rewriting, or
retiring a row.

## What to verify before editing

1. **Entity name** — use the canonical term, not an alias to avoid.
2. **Canonical type** — confirm the correct interface, schema, or module.
3. **Naming distinction** — preserve any relevant ambiguity or invariant.
4. **Current behavior** — do not encode incidental implementation details as contracts.

## What to do after editing domain code

If you introduce or change canonical vocabulary or an invariant, add it to the family member
that owns it:

| What resolved | Where it goes |
|---------------|---------------|
| a term describing this project's domain | `.agents/ubiquitous-language.md` |
| a term describing the harness itself | `.agents/ubiquitous-language-scaffold.md` |
| an invariant, whichever it constrains | `.agents/ubiquitous-language-invariants.md` |

Then:
- Set `Last updated` **on the file you actually edited** to the current ISO date only; do not
  append a summary.
- Add a row to the Changelog table in `.agents/ubiquitous-language-changelog.md`.
- Regenerate `.agents/ubiquitous-language-index.md` so the new term is reachable from the pointer
  table.

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

The output of these passes is a row in the spec's `## Glossary Changes` table, written to the same
600 B one-claim standard it will have to meet when it is promoted.

### When a term enters

**A term enters the glossary when its code lands, never when the design settles** (ADR 0127).
This reverses the former *"Write inline, never batched"* rule; do not restore it.

- During a `/grill`, a resolved term is recorded in the **design spec's `## Glossary Changes`**
  section, not written into the glossary.
- It is **promoted into the glossary when the implementation merges** — by the work that lands it,
  the same commit that makes the definition true. That promotion follows the post-edit procedure
  above: route the term to the family member that owns it, set `Last updated` on that file, add
  the Changelog row, and regenerate the index.
- There is **no marker for a term that is settled but unbuilt**. That convention is abolished, and
  the string `settled ahead of implementation` must not appear in a glossary file.

### Keep the glossary a glossary

The glossary family is a glossary and nothing else. It is not a spec, not a scratchpad, and not
a home for implementation decisions. During an interrogation:

- **Terminology** → the glossary.
- **Settled design decisions for this work** → the design spec (`design-interrogation.md`).
- **Decisions that outlive this work** → an ADR (`adr.md`).

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@`-imported in `CLAUDE.md` together with the index and the invariants (ADR-0016) |
| OpenCode | `AGENTS.md` Domain section |
