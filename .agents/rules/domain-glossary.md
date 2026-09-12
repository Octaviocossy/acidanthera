# Rule: Domain Glossary Check

**Before touching any domain code you MUST read the glossary row for the terms you are about to
touch.** Find them through `.agents/ubiquitous-language-index.md`, which is always in context.

## The five files

| File | Holds | Always in context? |
|------|-------|--------------------|
| `.agents/ubiquitous-language-index.md` | term → area pointers, generated, no definitions | **yes** |
| `.agents/ubiquitous-language-invariants.md` | invariants **1–38** | **yes** |
| `.agents/ubiquitous-language.md` | product vocabulary | no — read on demand |
| `.agents/ubiquitous-language-scaffold.md` | harness vocabulary + invariants **39–56** | no — see below |
| `.agents/ubiquitous-language-changelog.md` | historical record | no — and not in the corpus pack |

The index and the invariants are the only `@`-imported ones (ADR 0041). An invariant constrains
all code and a breach of one is a **hard violation** at the review gate, so it is always loaded; a
term's definition matters only to work that touches that term, so it is fetched on demand. The
changelog is non-authoritative by its own header and is excluded from both.

Invariants are **one numbering space split across two files** — 1–38 product, 39–56 scaffold.
Never renumber: the glossary body, both SKILLs and several ADRs cite them by number.

**Only 1–38 are `@`-imported, and that is deliberate** (ADR 0041 › Which invariants). Always-on
status is earned by constraining code an agent might write without knowing it is in scope, which
is true of every edit under `src/` and false of 39–56: breaching a scaffold invariant requires
editing the scaffold, and every context that does is already holding this family's scaffold file —
a reviewer through the corpus pack, an implementer through the index. A breach of 39–56 is a
**hard violation** exactly like a breach of 1–38; only the loading strategy differs.

## What counts as domain code

A file is domain code if it lives in a canonical domain path or names, exports, imports, or changes
a glossary concept.

**Canonical domain code paths for this project:**
- `src/` (TS frontend)
- `src-tauri/src/` (Rust backend)

## What belongs in the glossary

Concise definitions for canonical concepts, states, processes, data contracts, naming distinctions,
and cross-slice invariants. Definitions describe **current behavior only**.

Do not include component inventories, styling retrospectives, service wrappers without naming
ambiguity, exact caller or import graphs, or release chronology. Historical and superseded behavior
goes in `.agents/ubiquitous-language-changelog.md`.

## What to verify before editing

1. **Entity name** — use the canonical term, not an alias to avoid.
2. **Canonical type** — confirm the correct interface, schema, or module.
3. **Naming distinction** — preserve any relevant ambiguity or invariant.
4. **Current behavior** — do not encode incidental implementation details as contracts.

## The budget

`.agents/scripts/verify-scaffold.sh` §11 enforces this; it is not advisory (ADR 0043). Prose rules
were tried here — the 2026-07-22 cleanup wrote them, and the file grew roughly sixfold afterwards.

- **600 bytes per Notes cell, and per invariant.** The ceiling targets the tail, not the average:
  the median cell is ~293 B and already correct. Rows under it are not to be rewritten.
- **The one-claim rule.** A row states what the term **is**, its canonical type, and the one
  distinction that would otherwise be got wrong. Rationale belongs in the ADR the row cites, never
  restated beside the citation. If a row cannot fit without losing a distinction, move that
  distinction **into its ADR** and cite it — and if it has no ADR, that is the signal it should.
- **Warn at 80,000 B, fail at 100,000 B** on `.agents/ubiquitous-language.md` as a whole.
- **The retirement test** is the valve the cap opens, not routine pruning: remove a row if doing so
  would not change what anyone writes. An *aliases to avoid* entry is **not** evidence of value —
  the table template asks for one, so nearly every row has one.

## When a term enters

**A term enters the glossary when its code lands, never when the design settles** (ADR 0042).
This reverses the former *"Write inline, never batched"* rule; do not restore it.

- During a `/grill`, a resolved term is recorded in the **design spec's `## Glossary Changes`**
  section, not written into the glossary.
- It is **promoted into the glossary when the implementation merges** — by the work that lands it,
  the same commit that makes the definition true.
- There is **no marker for a term that is settled but unbuilt**. That convention is abolished, and
  the string `settled ahead of implementation` must not appear in a glossary file.

## Active mode (during a design interrogation)

Everything above is the **passive** discipline. During a `/grill`
(`design-interrogation.md`) the glossary is worked **actively** — you are changing the model, not
just consuming it. ADR 0042 changed *where* a resolved term lands, not whether the sharpening
happens, so all four passes still run:

1. **Challenge against the glossary.** When the user uses a term that conflicts with an existing
   definition, call it out: "the glossary defines *cancellation* as X, but you seem to mean Y."
2. **Sharpen fuzzy language.** When a term is vague or overloaded, propose a precise canonical one:
   "you're saying *account* — do you mean the Customer or the User?"
3. **Stress-test with concrete scenarios.** Abstract agreement hides disagreement; a scenario
   surfaces it.
4. **Cross-reference with code.** When the user states how something works, check whether the code
   agrees, and surface any contradiction.

The output of these passes is a row in the spec's `## Glossary Changes` table, written to the same
600 B one-claim standard it will have to meet when it is promoted.

## Keep the glossary a glossary

It is a glossary and nothing else — not a spec, not a scratchpad, not a home for implementation
decisions.

- **Terminology** → the glossary family.
- **Settled design decisions for this work** → the design spec (`design-interrogation.md`).
- **Decisions that outlive this work** → an ADR (`adr.md`).

## What to do after editing domain code

If you introduce or change canonical vocabulary or an invariant:

1. Add or amend the row in the right file — product vocabulary in `.agents/ubiquitous-language.md`,
   harness vocabulary in `.agents/ubiquitous-language-scaffold.md`.
2. Set `Last updated` in that file's header to the current ISO date only; do not append a
   summary. The vocabulary, invariants and scaffold files each carry one. The index does not —
   it is generated, and §11d proves its freshness by rebuilding it; nor does the changelog,
   whose every row is dated.
3. Add a **one-line** row to `.agents/ubiquitous-language-changelog.md`: date, what changed, and a
   pointer to the spec / ADR / issue that explains why. The essay belongs in the spec, not here.
4. Run `sh .agents/scripts/build-glossary-index.sh` and commit the regenerated index — §11 diffs it
   against a fresh build and fails on any difference.

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/domain-glossary.md`, `@.agents/ubiquitous-language-index.md` and `@.agents/ubiquitous-language-invariants.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` Domain section |
