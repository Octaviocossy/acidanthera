# Contributing to acidanthera

Thanks for taking an interest. This document covers what you need to build the app, what to run
before you open a pull request, and the conventions this codebase holds to.

If you are planning something substantial, **open an issue first**. The design is usually the
expensive part, and it is cheaper to settle it in an issue than in review.

## Getting set up

You will need:

- **Node** ≥ 18 and **pnpm** 10+
- A **stable Rust toolchain** plus the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/)
- **macOS** — see [Platform support](README.md#platform-support) for why

```bash
git clone https://github.com/Octaviocossy/acidanthera.git
cd acidanthera
pnpm install
pnpm tauri dev
```

`pnpm dev` runs the Vite server alone, which is useful for pure UI work but leaves every Tauri
command unavailable — anything touching the vault, settings, chats, or the agent needs
`pnpm tauri dev`.

The chat panel additionally needs [`claude`](https://claude.com/claude-code) and/or
[`codex`](https://github.com/openai/codex) installed and logged in. acidanthera spawns them as child
processes and inherits their session; it never handles API keys.

## Before you open a pull request

```bash
pnpm check      # Biome lint + format
pnpm build      # tsc type-check + Vite build
pnpm test       # Vitest
pnpm test:rust  # required for any change under src-tauri/src/
```

All four run in CI. `pnpm check:fix` will fix most lint and formatting complaints for you.

## Testing conventions

The full rule is [`.agents/rules/testing.md`](.agents/rules/testing.md). The short version:

**Placement.** Co-locate every test beside the module it covers — `foo.ts` → `foo.test.ts`,
`Foo.tsx` → `Foo.test.tsx`. There are no `__tests__/` directories. Rust tests live in a
`#[cfg(test)] mod tests` block inside the module under test, using `use super::*`.

**Harness.** Vitest, configured inline in `vite.config.ts` — there is no `vitest.config.ts`, so
tests resolve the same `@` alias as the app. Global test APIs are deliberately **off**: import
`describe` / `it` / `expect` / `vi` explicitly from `'vitest'` in every file. Shared setup goes
in `src/test/setup.ts`, not per-file.

**What to assert.** Observable behavior only — a pure function's return value, a store's state
after an action, a component's rendered output. Prefer `screen.getByRole` over
`container.querySelector`. Mock only at a real I/O boundary (Tauri's `invoke`, an agent's
spawned process); never mock internal pure functions or Zustand stores.

**Rust.** Name tests after the contract they check — `subject_should_expected_behavior`, as in
`create_note_in_should_not_clobber_an_existing_note`. Assert error *variants* with `matches!`
rather than their display text. Filesystem tests must create a unique temporary directory and
remove it afterwards; never read or mutate real user directories.

## The domain glossary

**Read [`.agents/ubiquitous-language.md`](.agents/ubiquitous-language.md) before changing
anything in `src/` or `src-tauri/src/`.** It is the canonical source for entity names, types,
data contracts, and the invariants the app maintains. Those invariants are binding — several are
the only thing standing between the current behavior and a class of bug that has already
happened once.

If your change introduces or alters canonical vocabulary or an invariant, update the glossary in
the same PR: add the term to the right section, set `Last updated` to the current ISO date, and
add a row to the Changelog table.

Decisions that outlive the change that produced them belong in an ADR under
[`.agents/adr/`](.agents/adr/), not in the glossary. The bar is deliberately high — see
[`.agents/rules/adr.md`](.agents/rules/adr.md) for the three-part test.

## Design system

UI work in `src/components` or `src/styles` follows the acidanthera design system, encoded in
[`.agents/skills/acidanthera-design/SKILL.md`](.agents/skills/acidanthera-design/SKILL.md): the five-step
surface ladder, four-step text ladder, and semantic radius ladder named by what a value wraps
rather than by its size.

The one rule worth stating here, because it is the easiest to break by accident: **the ember
accent means "the AI acted here" and nothing else.** No success state, status indicator, brand
mark, or decorative fill may use it. See
[ADR 0007](.agents/adr/0007-accent-is-ai-only.md) and invariant 21.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/). Scope with the issue number when
there is one:

```
feat(#123): add keyboard tab switching
fix: stop the config watcher clobbering a dirty buffer
docs: correct the keymaps.toml path for macOS
```

## Code style

Biome 2.2.0 is the only linter and formatter — there is no ESLint and no Prettier. Configuration
lives in `biome.json`; `pnpm check:fix` applies it.

## The agent workflow (optional)

This repository is developed agent-first, and `.agents/` is committed as part of the project.
**None of it is required to contribute** — a normal PR is perfectly welcome. It is documented
here because you will see the directory and the artifacts it produces.

The loop is: `/grill` interrogates a design until nothing is left assumed and writes a settled
spec to `.agents/specs/`; that spec routes to `/planning` (a plan file in `.agents/plans/`),
`/create-issue` (one GitHub issue), or `/spec-breakdown` (an epic plus child issues executed in
parallel). Decisions that outlive the work land in `.agents/adr/`.

[`.agents/docs/workflow.en.md`](.agents/docs/workflow.en.md) explains how the pieces fit
together ([Español](.agents/docs/workflow.es.md)).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
