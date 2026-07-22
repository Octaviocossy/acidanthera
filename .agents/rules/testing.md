# Rule: Testing (Vitest and Cargo)

This rule is the project-specific adaptation of the generic "write tests for what you touch"
guidance: it pins down *where* tests live, *what* harness runs them, and *what's in/out of scope*
for this Tauri + React + TypeScript codebase, so any agent can add a test without re-deriving
these decisions.

## Scope

### Frontend — Vitest

- **Pure logic modules** (`src/lib/**`, e.g. `chat-file.ts`, `chat-prompt.ts`) — the
  highest-value target: no DOM, no mocking, deterministic input → output.
- **Zustand stores** (`src/stores/**`) — call actions and assert on `useXStore.getState()`
  directly; don't route a store test through a mounted component.
- **React components** (`src/components/**`) — via Testing Library, asserting user-facing
  behavior (rendered text, roles, interactions), never internal state or implementation details.

### Backend — Cargo

- **Rust logic** (`src-tauri/src/**`) — cover deterministic helpers, validation, serialization,
  error mapping, and filesystem behavior with Rust unit tests.
- Keep Tauri commands thin. Extract testable helpers that take explicit inputs (for example,
  `*_in` functions receiving a root path) and test those helpers instead of initializing a Tauri
  runtime in a unit test.
- Network I/O, spawned processes, and the full Tauri runtime are out of scope for unit tests.
  Use a dedicated integration-test design when those boundaries need coverage.

## File placement & naming

- Co-locate the test next to the module it covers: `foo.ts` → `foo.test.ts`,
  `Foo.tsx` → `Foo.test.tsx`. No `__tests__` directories — co-location keeps a module and its
  test adjacent, which also keeps the domain-glossary review pass (`.agents/rules/domain-glossary.md`)
  simple: a test file for domain code is domain code.
- Shared test setup lives in `src/test/setup.ts` (currently: `@testing-library/jest-dom/vitest`,
  which both extends `expect` with DOM matchers and provides the matching Vitest types). Wire any
  new global setup there, not per-file.
- Co-locate Rust unit tests in the module under test using `#[cfg(test)] mod tests`. Import
  private module items with `use super::*`; keep `src-tauri/tests/` for future integration tests.
- Name Rust tests after their observable contract using
  `subject_should_expected_behavior`, matching existing backend tests such as
  `create_note_in_should_not_clobber_an_existing_note`.

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

### Frontend

- Assert **observable behavior** — a pure function's return value, a store's state after an
  action, a component's rendered output/interactions — never internal implementation details.
- Prefer `screen.getByRole`/`getByText` over `container.querySelector`.
- Mock only at a real I/O boundary: Tauri's `invoke` (`@tauri-apps/api`) and an `AgentBackend`'s
  spawned process are the two boundaries in this codebase. Don't mock internal pure functions or
  Zustand stores — call the real ones.
- One assertion-worthy behavior per `it`; group with `describe` by module/function, not by
  scenario category (no `describe('edge cases')`).

### Rust

- Use Rust's built-in `#[test]` attribute. Test return values and resulting filesystem state,
  never private implementation details that are not part of a helper's contract.
- For typed errors, use `expect_err` and `matches!` to assert the error variant rather than its
  display text, unless the message itself is part of the contract.
- Create deterministic fixtures. Filesystem tests must create a unique temporary directory and
  remove it when the test finishes; do not read or mutate user directories.
- Gate platform-specific behavior with `#[cfg(...)]`, as with Unix executable-permission tests.
- Do not add test-only dependencies when standard-library fixtures and assertions suffice.

## Commands

### Frontend

- Run once (CI-style): `pnpm test`
- Watch mode: `pnpm test:watch`
- Coverage (v8 provider, HTML report in `coverage/`, gitignored): `pnpm coverage`

### Rust

- Run the backend suite from the repository root: `pnpm test:rust`
- Run a focused module suite: `cargo test --manifest-path src-tauri/Cargo.toml vault::tests`
- Run the Rust suite for every change in `src-tauri/src/**`.

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/testing.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` › Testing section |
