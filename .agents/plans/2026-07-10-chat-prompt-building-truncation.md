# Plan: Chat prompt building & message-count truncation

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #69 (epic #66 — chat management & history)

## Goal

Give epic #66 a pure, engine-agnostic way to **rebuild the prompt for a resumed chat** and to
**bound a transcript to the last N messages**, so that a conversation loaded from disk (#68) can be
continued coherently without replaying an unbounded, ever-growing context. Types + logic only —
**no** UI, store, filesystem, or Rust changes — mirroring how #67 defined the chat-file format
contract before the save/load loop was built.

## Context

- **What exists today:** the chat transcript lives in memory as `useChatStore.items`
  (`ChatItem[]` — `user_message | agent_message | tool_call | error`, `src/stores/chat-store.ts`).
  `sendMessage` forwards the **raw user text** to the running backend
  (`AgentBackend.send(prompt)`). During a *live* session that is correct: each CLI keeps its own
  conversation state (Claude Code = long-lived NDJSON process; Codex = `exec resume <thread_id>`).
- **What prompted this:** epic #66 (chat management & history). #67 landed the on-disk `ChatFile`
  format + codec; #68 lands persistence (save/load to the vault). The missing piece is **resume**:
  when a saved chat is re-opened after a restart, the live backend is a *fresh* process with **no
  memory** of the prior turns. To continue the conversation the app must replay the earlier
  transcript into the next turn's prompt — and cap that replay so context stays bounded.
- **Constraints:**
  - Foundation-first / conflict-safe (`parallel-orchestration.md`): this slice is **additive** —
    a new pure module under `src/lib/chat/`, no edits to any shared file — so it never conflicts
    with its epic sibling #68.
  - Pure functions, **no clock / no I/O** (same discipline as `chat-file.ts`): easy to reason
    about and to unit-check with a throwaway script (no test runner is configured — `AGENTS.md`).
  - Engine-agnostic: the module emits a plain prompt string; it never imports a backend and never
    branches on `AgentSource` (the UI/store rule from `agent-event.ts`, #13).
  - Live turns are **not** touched: replaying history on a live, same-process turn would duplicate
    what the CLI already remembers — the resume prompt is for the *first continued turn only*.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/chat/chat-prompt.ts` | The prompt/truncation contract: `DEFAULT_MAX_MESSAGES`, `isConversationalMessage`, `countMessages`, `truncateByMessageCount`, `BuildResumePromptOptions`, `buildResumePrompt` |
| MODIFY | `.agents/ubiquitous-language.md` | Register the new entities/functions; bump "Last updated"; add a Changelog row (domain-glossary rule) |
| CREATE | `.agents/plans/2026-07-10-chat-prompt-building-truncation.md` | This plan |

## Step-by-Step Implementation

1. **Create `src/lib/chat/chat-prompt.ts`.**
   - Type-only import: `ChatItem` from `@/stores/chat-store` (erased under `isolatedModules`; the
     store never imports this module → no cycle, exactly like `chat-file.ts`).
   - `DEFAULT_MAX_MESSAGES = 20` — the default message-count cap.
   - Message unit: a *conversational message* = a `user_message` **or** `agent_message`. Tool-call
     and error rows are sub-turn/structural artifacts — they do **not** count toward the limit and
     are **not** replayed into a resume prompt (keeps the prompt lean and the count meaningful).
   - `isConversationalMessage(item): item is Extract<ChatItem, { kind: 'user_message' | 'agent_message' }>`
     — a type guard so `.filter()` narrows the element type (both variants carry `text`).
   - `countMessages(items): number` — how many conversational messages a transcript holds.
   - `truncateByMessageCount(items, maxMessages = DEFAULT_MAX_MESSAGES): ChatItem[]` — keep the
     suffix of `items` starting at the `maxMessages`-th conversational message counted from the
     end, so at most `maxMessages` messages survive with their interleaved tool/error rows intact;
     returns a fresh array (never mutates). `maxMessages <= 0` → `[]`; a non-integer is floored;
     fewer messages than the cap → a copy of the whole input.
   - `BuildResumePromptOptions = { maxMessages?: number; header?: string }`.
   - `buildResumePrompt(history, userMessage, options?): string` — trims `userMessage`; truncates
     `history` to `maxMessages`; renders the surviving conversational messages as `You: …` /
     `Assistant: …` blocks under a short header, then a `---` divider, then the new message. When
     the (truncated) history has no conversational messages, returns the bare trimmed
     `userMessage` (nothing to replay) — so a brand-new chat's first turn is unchanged.
   - Header comment documents *why the module exists* (resume, not live turns) and the message-unit
     decision, mirroring `chat-file.ts`'s doc style.

2. **Update `.agents/ubiquitous-language.md`** — add a `Chat prompt (resume)` / `Message-count
   truncation` entity + the functions to Core entities, a Relationships note (module imports only
   `ChatItem` *types*; consumed by the future resume loop, not wired yet), bump "Last updated",
   append a Changelog row.

## Architecture Decisions

- **Resume-prompt, not live-turn prompt.** The only time the app must hand a backend the prior
  context is when continuing a chat whose backend process is gone (loaded from disk). Live turns
  keep going through the CLI's own session untouched — so `buildResumePrompt` is explicitly framed
  for the *first continued turn* and returns the raw message when there is nothing to replay.
- **"Message" = user/agent turn only.** Counting tool-calls/errors toward a "message" limit would
  make the cap unpredictable and replay verbose tool JSON into the prompt. Truncation still
  *carries* interleaved tool/error rows within the retained window (so `truncateByMessageCount`
  stays a faithful transcript primitive reusable elsewhere), but the resume prompt renders only the
  conversational messages.
- **Pure, additive, engine-agnostic.** No shared file is touched (conflict-safe against #68), no
  clock/I/O (testable), no backend import (the growth-point rule). Same shape as the #67 foundation
  slice: the format/logic contract lands first; *where/when* it's used is a later slice's job.

## Validation Criteria

- [x] `src/lib/chat/chat-prompt.ts` compiles under `strict` tsc (`pnpm build`).
- [x] `pnpm check` (Biome lint+format) passes.
- [x] `truncateByMessageCount` keeps exactly the last N conversational messages (with their
      trailing tool/error rows), returns `[]` for `N <= 0`, and copies (never mutates) the input —
      verified by a throwaway Node script during implementation (not committed; no runner).
- [x] `buildResumePrompt` replays `You:`/`Assistant:` context above a `---` divider and returns the
      bare message when there is no prior conversational context.
- [x] No backend/`AgentSource` import; no store/UI/Rust/filesystem change.
- [x] Ubiquitous-language glossary updated + "Last updated" bumped + Changelog row added.

## Open Questions

None. Wiring `buildResumePrompt` into the resume/send loop, persisting/loading the transcript, and
the history UI are deliberately out of scope — they are separate epic-#66 slices (#68 and later)
that consume this contract.
