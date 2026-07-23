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

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/domain-glossary.md` and `@.agents/ubiquitous-language.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` Domain section |
