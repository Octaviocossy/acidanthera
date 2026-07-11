# Rule: Testing (Vitest)

This rule is the project-specific adaptation of the generic "write tests for what you touch"
guidance: it pins down *where* tests live, *what* harness runs them, and *what's in/out of scope*
for this Tauri + React + TypeScript codebase, so any agent can add a test without re-deriving
these decisions.

## Scope — what gets a Vitest test

- **Pure logic modules** (`src/lib/**`, e.g. `chat-file.ts`, `chat-prompt.ts`) — the
  highest-value target: no DOM, no mocking, deterministic input → output.
- **Zustand stores** (`src/stores/**`) — call actions and assert on `useXStore.getState()`
  directly; don't route a store test through a mounted component.
- **React components** (`src/components/**`) — via Testing Library, asserting user-facing
  behavior (rendered text, roles, interactions), never internal state or implementation details.
- **Out of scope for Vitest:** `src-tauri/src/**` (Rust). Rust logic is tested with `cargo test`
  inside `src-tauri/`, a separate toolchain this rule does not cover.

## File placement & naming

- Co-locate the test next to the module it covers: `foo.ts` → `foo.test.ts`,
  `Foo.tsx` → `Foo.test.tsx`. No `__tests__` directories — co-location keeps a module and its
  test adjacent, which also keeps the domain-glossary review pass (`.agents/rules/domain-glossary.md`)
  simple: a test file for domain code is domain code.
- Shared test setup lives in `src/test/setup.ts` (currently: `@testing-library/jest-dom/vitest`,
  which both extends `expect` with DOM matchers and provides the matching Vitest types). Wire any
  new global setup there, not per-file.

## Harness

- Runner: **Vitest**. Config lives inline in `vite.config.ts`'s `test` block — there is no
  separate `vitest.config.ts` — so tests resolve the same `@` alias and run through the same
  React/Tailwind Vite plugins as the app, with zero drift between dev and test module resolution.
- Environment: `jsdom` for all tests (the project has no server-only/Node-only code that would
  need the `node` environment).
- Library: `@testing-library/react` + `@testing-library/user-event` for components.
- **No global test APIs.** `test.globals` is left `false` — import `describe`/`it`/`expect`/`vi`
  explicitly from `'vitest'` in every test file. This matches the project's explicit-import style
  elsewhere and avoids widening `tsconfig.json`'s `types` just to add ambient test globals.

## Writing tests

- Assert **observable behavior** — a pure function's return value, a store's state after an
  action, a component's rendered output/interactions — never internal implementation details.
- Prefer `screen.getByRole`/`getByText` over `container.querySelector`.
- Mock only at a real I/O boundary: Tauri's `invoke` (`@tauri-apps/api`) and an `AgentBackend`'s
  spawned process are the two boundaries in this codebase. Don't mock internal pure functions or
  Zustand stores — call the real ones.
- One assertion-worthy behavior per `it`; group with `describe` by module/function, not by
  scenario category (no `describe('edge cases')`).

## Commands

- Run once (CI-style, what `AGENTS.md` › Commands › Test points to): `pnpm test`
- Watch mode: `pnpm test:watch`
- Coverage (v8 provider, HTML report in `coverage/`, gitignored): `pnpm coverage`

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/testing.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` › Testing section |
