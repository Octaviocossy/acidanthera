# Rule: Domain Glossary Check

**Before touching any domain code you MUST read `.agents/ubiquitous-language.md`.**

## What counts as domain code

A file is domain code if it:
- Lives in a path this project designates as canonical domain code (list those paths below)
- Names, exports, or imports an entity listed in the glossary

> **Project setup required:** Replace the placeholder list below with the actual canonical
> domain code paths for this project (e.g. `packages/models/src/`, `src/domain/`, `src/entities/`).

**Canonical domain code paths for this project:**
- `src/` (TS frontend)
- `src-tauri/src/` (Rust backend)

## What to verify before editing

1. **Entity name** — use the canonical term, not an alias-to-avoid.
2. **Canonical type** — confirm the correct interface / schema name and its package.
3. **Aliases to avoid** — check the "Aliases to avoid" column; do not introduce them.
4. **Relationships** — ensure FKs, join tables, and cascade rules match the "Relationships" section.
5. **Auth processes** — if adding or renaming an endpoint, check for correct trigger routes and terminology.

## What to do after editing domain code

If you introduce a new entity, state, or process:
- Add it to `.agents/ubiquitous-language.md` under the correct section.
- Bump "Last updated".
- Add a row to the Changelog table.

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/domain-glossary.md` and `@.agents/ubiquitous-language.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` Domain section |
