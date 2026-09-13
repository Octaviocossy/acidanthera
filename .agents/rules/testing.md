# Rule: Testing

This rule states what to test, where tests live, and how to write them, independent of any
specific language or framework. It is the scaffold's default until a stack is adopted; once one
is, fill in the placeholders below (and the matching `AGENTS.md` › Testing / Commands sections)
with the concrete runner, placement convention, and commands — do not leave both files silently
disagreeing.

## Scope

Write tests for what you touch, prioritized by how cheaply they catch regressions:

- **Pure logic** (functions with no I/O — parsing, transforms, calculations) — the highest-value
  target: deterministic input → output, no mocking required.
- **Stateful modules** (stores, caches, services owning in-memory or persisted state) — exercise
  the public actions/methods and assert on resulting state, not on internal fields.
- **Interactive/UI units** (components, CLI commands, HTTP handlers) — assert user- or
  caller-observable behavior (rendered output, response body/status, exit code), never
  implementation details.
- **Boundary code** (network calls, spawned processes, filesystem, full runtime bootstrapping) —
  out of scope for unit tests. Cover these with a dedicated integration-test design when the
  project needs that coverage; don't fake a whole runtime just to unit-test a boundary.

## File placement & naming

_Not yet documented — record the project's placement convention once a stack is adopted (e.g.
co-located `foo.ts` → `foo.test.ts`, or a mirrored `tests/` tree), and its test-naming
convention._

Whatever convention is chosen, keep a test next to (or clearly traceable to) the module it
covers, so a test for domain code is treated as domain code by
`.agents/rules/domain-glossary.md`.

## Harness

_Not yet documented — record the test runner(s), assertion library, and any environment
configuration (e.g. DOM shims, database fixtures) once a stack is adopted._

## Writing tests

These principles hold regardless of stack:

- Assert **observable behavior** — a function's return value, a store's state after an action, a
  component's rendered output, an API's response — never internal implementation details.
- Mock only at a real I/O boundary (network, filesystem, subprocess, external service). Don't mock
  internal pure functions, stores, or other in-process code — call the real ones.
- Create deterministic fixtures. Filesystem or database tests must use a unique temporary
  location and clean up after themselves; never read or mutate shared/user state.
- One assertion-worthy behavior per test; group related tests by module/function, not by a
  scenario-category label (no `describe('edge cases')`-style grouping).
- Prefer role/content-based queries and public APIs over structural selectors or private-field
  access, when the harness offers that choice.
- Don't add test-only dependencies when the standard library or an already-adopted library's
  fixtures and assertions suffice.

## Commands

_Not yet documented — once a runner is adopted, fill in `AGENTS.md` › Commands › `Test:` and
reference it here rather than duplicating the command._

## Cross-agent applicability

| Agent | Enforcement mechanism |
|-------|-----------------------|
| Claude Code | `@.agents/rules/testing.md` inlined in `CLAUDE.md` |
| OpenCode | `AGENTS.md` › Testing section |
