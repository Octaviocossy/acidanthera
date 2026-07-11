# Plan: Chat-file format contract & serialization

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #67 (epic #66 — chat management & history)

## Goal

Define the on-disk **chat-file** format and its pure (de)serialization so that later
epic-#66 slices (save-on-turn, a history list, resume) build on a stable, faithful contract.
This is the foundation slice — types + serialization only, **no** UI, store, filesystem, or
Rust changes — mirroring how #13 defined the `AgentEvent` contract before the chat was built.

## Context

- **What exists today:** the chat transcript lives only in memory as `useChatStore.items`
  (`ChatItem[]` — a discriminated union of `user_message | agent_message | tool_call | error`,
  `src/stores/chat-store.ts`). Nothing persists a conversation; closing/switching models loses it.
- **What prompted this:** epic #66 (chat management & history). Its first, foundation-first
  slice is a *format contract* every sibling depends on, so the storage location, the save/load
  loop, and the history UI can be built against a versioned, round-trippable file shape.
- **Constraints:**
  - Project invariant (v0-spec §3.1): the source of truth is **plain, human-readable markdown**;
    everything else is reconstructible. A saved chat should be a readable `.md` note.
  - Ubiquitous-language rule: **never persist `engine` separately from `model`** — the engine is
    derived from the model. So the frontmatter stores `model` only.
  - No YAML/frontmatter dependency is installed, and `package.json` is a shared/foundation
    artifact — adding a dep risks cross-branch conflicts. The frontmatter is a tiny fixed set of
    scalars, so a hand-rolled codec is used instead of pulling in a library.
  - No test runner is configured (`AGENTS.md` › Commands), so correctness is guaranteed by design
    + `pnpm check` + `pnpm build`; the round-trip contract is documented in the module header.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/chat/chat-file.ts` | The chat-file contract: `ChatFile`/`ChatFileMeta` types, schema/extension constants, `serializeChatFile`, `parseChatFile`, `isChatFilePath`, `deriveChatTitle` |
| MODIFY | `.agents/ubiquitous-language.md` | Register the new `ChatFile` entity + serialization terms; bump "Last updated"; add a Changelog row (domain-glossary rule) |
| CREATE | `.agents/plans/2026-07-10-chat-file-format-contract.md` | This plan |

## Step-by-Step Implementation

1. **Create `src/lib/chat/chat-file.ts`.**
   - Type-only imports: `ChatItem`, `ChatToolCall` from `@/stores/chat-store`; `AgentModelId`
     from `@/lib/agent/model-catalog`.
   - Constants: `CHAT_FILE_SCHEMA = 1`, `CHAT_FILE_EXTENSION = '.chat.md'` (a `.md` subtype so the
     file stays readable and a sibling can detect/hide it).
   - `ChatFileMeta` = `{ schema; id; title; model: AgentModelId; created: string; updated: string }`
     — ISO-8601 timestamps supplied by the caller (functions stay pure; no `Date.now()` inside).
     No `engine` field (derived from `model`).
   - `ChatFile` = `{ meta: ChatFileMeta; items: ChatItem[] }`.
   - `ChatFileParseResult` = `{ ok: true; file } | { ok: false; error }` (no throwing — mirrors the
     app's toast/error-item style).
   - `serializeChatFile(file): string` — a `---` frontmatter block (each scalar `JSON`-encoded so
     arbitrary titles round-trip) followed by one block per item: messages/errors as verbatim prose
     under a hidden `<!-- orbit:chat kind="…" id="…" -->` marker line + a readable blockquote label;
     `tool_call` as a ```json fence of the `ChatToolCall`.
   - `parseChatFile(raw): ChatFileParseResult` — split off frontmatter, then split the body on
     **full-line-anchored** markers (so a marker embedded inside indented JSON never triggers a
     false split); decode each block by kind; greedy ```json fence match so tool results containing
     inner code fences still round-trip. Missing frontmatter → `ok:false`; a corrupt `tool_call`
     fence → `ok:false`; otherwise resilient (missing meta fields default).
   - `isChatFilePath(path): boolean` and `deriveChatTitle(items): string` (first user line, ≤60
     chars, `Untitled chat` fallback) — pure helpers the save slice will want.
   - Header comment documents the one in-band limitation (a message line that is *exactly* the
     namespaced marker would be misread) — negligible and acceptable for a personal v0 tool.

2. **Update `.agents/ubiquitous-language.md`** — add `Chat file`, `ChatFileMeta`, and the
   serialization functions to Core entities; add a Relationships note (engine derived from model,
   not stored); bump "Last updated"; append a Changelog row.

## Architecture Decisions

- **Markdown + hidden markers over a single JSON blob or a new dependency.** Honors the
  plain-markdown invariant (a chat reads as prose in Obsidian; the markers are HTML comments,
  hidden on render) while still round-tripping the full discriminated union. Full-line-anchored,
  namespaced markers + greedy JSON-fence matching make it robust in practice; the residual
  in-band collision (a prose line identical to a marker) is documented, not engineered away —
  proportionate to a single-user v0 tool.
- **`model` only, engine derived.** Enforces the ubiquitous-language rule; a hand-edited/unknown
  model string still parses and falls back via `getModel()` at the consumer, exactly like
  `Settings.model`.
- **Pure functions, caller-supplied timestamps.** Keeps the contract testable and side-effect-free;
  the future save slice owns *when* a chat is written and stamps `created`/`updated`.
- **Additive only.** No shared file is touched, so the slice is conflict-safe against its epic
  siblings — the foundation-first heuristic (`parallel-orchestration.md`).

## Validation Criteria

- [x] `src/lib/chat/chat-file.ts` compiles under `strict` tsc (`pnpm build`).
- [x] `pnpm check` (Biome lint+format) passes.
- [x] `serializeChatFile` → `parseChatFile` round-trips every `ChatItem` kind and the metadata,
      including messages that contain code fences and tool results with inner ``` fences (verified
      by a throwaway Node script during implementation; not committed — no runner configured).
- [x] No `engine` field is persisted in the frontmatter.
- [x] Ubiquitous-language glossary updated + "Last updated" bumped + Changelog row added.

## Open Questions

None. Storage location, the save/load loop, hiding chat files from the sidebar, and the history
UI are deliberately out of scope — they are separate epic-#66 slices that consume this contract.
