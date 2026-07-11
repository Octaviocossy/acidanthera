# Plan: Epic — Unit & integration test suite for `src` and `src-tauri`

> Status: **completed**
> Created: 2026-07-11
> Updated: 2026-07-11
> Issue: #73
> Integration branch: epic/73-test-suite
> Epic PR: #80

## Goal

Stand up a Vitest harness for the React frontend (currently zero tests) and fill the one Rust
test gap (`agent.rs`), adding high-signal tests on business-critical logic — chat-file
serialization, resume-prompt building, agent stream→`AgentEvent` translation, store state
machines, vault helpers, and headless-engine PATH resolution — per a project-adapted testing
rule. High signal over blanket coverage; no coverage-percentage gate.

## Context

- **Frontend (`src/`)**: no tests, no runner installed. The upstream rule the user supplied
  targets a different project (ERP, `frontend/`, axios, TanStack Query, Spanish domain) and must
  be **adapted** — orbit-111 is a Tauri 2 app (React 19 + Vite 7 + Zustand), the repo root *is*
  the frontend, there is no axios/TanStack Query.
- **Backend (`src-tauri/`)**: already well-tested via `#[cfg(test)]` — `vault.rs` (19),
  `chats.rs` (10), `settings.rs` (3). The **only** gap is `agent.rs` (0), whose command/PATH
  resolution is security- and reliability-critical.
- **Decomposition**: foundation-first. #74 owns every shared config file (package.json,
  tsconfig, vitest.config, `src/test/*`, the adapted rule, AGENTS.md) so the four wave-2 frontend
  slices add **only** colocated `*.test.ts` files → no epic-branch conflicts. #75 (Rust) touches
  only `src-tauri/src/agent.rs`, disjoint from everything else, so it runs in wave 1 in parallel.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #74 | `74-vitest-test-harness` | Vitest test harness + adapted testing rule (foundation) | done |
| 1 | #75 | `75-rust-agent-process-tests` | Rust agent-process command/PATH resolution tests | done |
| 2 | #76 | `76-chat-lib-tests` | chat-file codec & resume-prompt logic tests | done |
| 2 | #77 | `77-agent-backend-tests` | agent backend adapter (stream→AgentEvent) tests | done |
| 2 | #78 | `78-store-logic-tests` | store state-machine tests (chat / history / app) | done |
| 2 | #79 | `79-vault-helper-tests` | vault helper tests (create-entry / flatten-tree) | done |

## Dependency Edges

```
76 -> 74
77 -> 74
78 -> 74
79 -> 74
```

(#75 has no dependencies — independent wave-1 slice. #74 is the foundation dependency root.)

## Acceptance (per child)

- Frontend children (#74, #76–#79): `pnpm test` passes, `pnpm build` (tsc type-checks colocated
  `.test.ts`), `pnpm lint` (Biome) green.
- Rust child (#75): `cargo test --manifest-path src-tauri/Cargo.toml` passes; `Cargo.toml`
  unchanged (std-only, temp-dir pattern from the sibling modules).

## Architecture Decisions

- **Standalone `vitest.config.ts`** rather than a `test` block in the Tauri async `vite.config.ts`.
- **No provider wrapper** in `render.tsx` (Zustand needs none; the upstream `QueryClientProvider`
  helper does not apply).
- **Adapted rule** at `.agents/rules/unit-testing.md` maps the upstream "core" list to orbit-111:
  chat-file codec (the silent-corruption / "money math" equivalent), chat-prompt, agent adapters,
  store state machines, vault helpers, Rust `agent.rs`.
- **Reset Zustand stores** in each store test's `beforeEach` (module-global singletons).
- **Mock at the boundary**: services under stores; `agentProcessService` under backends.
- **No child edits `.agents/ubiquitous-language.md`** — tests add no domain entity; avoids
  parallel-branch conflicts on the glossary.

## Validation Criteria

- [x] All six children merged into `epic/73-test-suite`.
- [x] On the epic branch: `pnpm test` green (138/138), `pnpm build` green, `pnpm lint` green,
      `cargo test --manifest-path src-tauri/Cargo.toml` green (47/47).
- [x] `AGENTS.md` › Commands › Test reads `pnpm test`.
- [x] Single `epic → main` PR opened (`Closes #73`) — PR #80.

## Open Questions

None.
