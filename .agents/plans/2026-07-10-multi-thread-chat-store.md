# Plan: Multi-thread chat store & stateless owns-history turns

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #70 (epic #66 — chat management & history)

## Goal

Wire the three completed epic-#66 foundations (#67 chat-file format, #68 `.orbit/chats`
persistence, #69 resume-prompt/truncation) into the in-memory `useChatStore` so a conversation
is a durable, switchable **thread**: the store **owns the history** (auto-saves every turn to
`.orbit/chats/<id>.chat.md`), supports **multiple threads** (start a new chat; load a saved one),
and each turn is **stateless across thread/session boundaries** — when the running backend has no
memory of a thread (loaded from disk, or the model was switched), the store replays its owned
history via `buildResumePrompt` instead of relying on the backend's process/session state.

## Context

- **What exists today:**
  - `useChatStore` (`src/stores/chat-store.ts`) holds a single in-memory transcript (`items:
    ChatItem[]`), `modelId`, `turnActive`, `sessionStarted`. `sendMessage` starts the backend
    lazily on the first turn and forwards the **raw** user text to `backend.send` every turn —
    relying entirely on the CLI's own session memory (Claude Code long-lived process; Codex `exec
    resume`). Nothing persists; there is exactly one conversation and no way to start a second.
  - **#67** `src/lib/chat/chat-file.ts` — `ChatFile`/`ChatFileMeta`, `CHAT_FILE_SCHEMA`,
    `CHAT_FILE_EXTENSION`, the round-trippable `serializeChatFile`/`parseChatFile` codec, and
    `deriveChatTitle`. Pure; owns the on-disk *shape* only.
  - **#68** `src-tauri/src/chats.rs` + `src/services/chats.service.ts` (`chatsService`) —
    format-agnostic `saveChat`/`readChat`/`listChats`/`deleteChat` over `.orbit/chats/<id>.chat.md`
    inside the open vault, keyed by a bare `id` (validated by Rust `is_safe_id`: non-empty, not
    `.`/`..`, no `/ \ \0`). Hidden from the sidebar by `build_tree`'s dot-prefix skip.
  - **#69** `src/lib/chat/chat-prompt.ts` — `buildResumePrompt` (replay the truncated prior
    transcript + `---` divider + new message, for the **first continued turn of a chat loaded from
    disk**), `truncateByMessageCount`/`DEFAULT_MAX_MESSAGES`, `countMessages`. Pure; **not yet
    wired** into the store. Its design is explicit: live same-session turns send raw text; only the
    resume boundary replays history.
- **What prompted this:** epic #66. #67/#68/#69 shipped the format, storage, and resume logic as
  isolated contracts; #70 is the slice that finally **consumes them in `useChatStore`** so the app
  gains persistence + multi-thread + resume as one user-observable behavior.
- **Constraints / decisions:**
  - **Approach = resume-on-boundary (not replay-every-turn).** `chat-prompt.ts` (#69) was built for
    "first continued turn only": replaying history on a live same-process turn would duplicate what
    the CLI already remembers. So the store keeps live turns sending raw text and replays history
    **only** when a fresh backend has no memory of the thread — i.e. after `loadChat` or a model
    switch. "Owns-history" = the store's `items` + the saved file are the durable source of truth
    (not the backend process); "stateless turns" = the store can reconstruct any thread's context
    from its owned history, so a turn never *depends* on hidden backend session state surviving.
  - **No runtime import cycle.** `chat-file.ts`/`chat-prompt.ts` import `ChatItem` **type-only**
    from the store (erased under `isolatedModules`); the store now imports their **runtime**
    exports. Only the store→lib runtime edge exists — same fact the glossary already records.
  - **`id` is a bare, filename-safe stem** (`chat-<epochMs>-<seq>`) — no separators/colons, safe on
    every OS and accepted by Rust `is_safe_id`. Generated lazily on first persist.
  - **Best-effort persistence.** A save failure surfaces a `useToastStore` error toast (like
    `useSaveLoop`), never blocks the turn or corrupts state. No vault open → no save (the send path
    already errors on the missing vault when it tries to start the backend).
  - **Minimal, additive UI.** A single "New chat" control in `ChatPanel`'s existing reserved top
    band makes multi-threading user-observable; the full **history-browse list** (the UI that calls
    `loadChat`) is a later epic-#66 slice. The store still exposes `loadChat`/`loadChatById` now so
    that slice has nothing to change in the store.
  - **No test runner** (`AGENTS.md`); correctness verified by `pnpm lint` + `pnpm build` and a
    throwaway reasoning check of the resume/persist paths (Rust unchanged → no `cargo` run needed).

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/stores/chat-store.ts` | Thread identity (`chatId`/`title`/`createdAt`), `pendingResume`; `newChat`/`loadChat`/`loadChatById`/`persistCurrentChat`; save-on-turn; resume via `buildResumePrompt`; model-switch replays history |
| MODIFY | `src/components/layout/ChatPanel.tsx` | Add a minimal "New chat" button in the reserved top band |
| MODIFY | `.agents/ubiquitous-language.md` | Update the `Chat store` entity + relationships; bump "Last updated"; add a Changelog row |
| CREATE | `.agents/plans/2026-07-10-multi-thread-chat-store.md` | This plan |

## Step-by-Step Implementation

1. **Extend `useChatStore` state & interface** — `src/stores/chat-store.ts`.
   - New imports (runtime): `serializeChatFile`, `parseChatFile`, `deriveChatTitle`,
     `CHAT_FILE_SCHEMA`, and type `ChatFile` from `@/lib/chat/chat-file`; `buildResumePrompt`,
     `countMessages` from `@/lib/chat/chat-prompt`; `chatsService` from `@/services/chats.service`;
     `useToastStore` from `./toast-store`.
   - Add to `ChatState`: `chatId: string | null` (persisted id; `null` = unsaved fresh thread),
     `title: string` (preserves a loaded custom title; `''` = derive from items), `createdAt:
     string | null` (ISO; preserved across saves), `pendingResume: boolean` (next turn must replay
     owned history because the backend has no memory of this thread).
   - Add methods to the interface: `newChat: () => void`, `loadChat: (file: ChatFile) => void`,
     `loadChatById: (id: string) => Promise<void>`, `persistCurrentChat: () => Promise<void>`.
   - Initial values: `chatId: null, title: '', createdAt: null, pendingResume: false`.

2. **Id generator** — module scope: `let chatSeq = 0; function newChatId() { chatSeq += 1; return
   \`chat-${Date.now()}-${chatSeq}\`; }`. Epoch-ms + counter → unique, sortable, filename-safe.

3. **`persistCurrentChat`** — serialize the current thread and save it (best-effort).
   - Read `get()`; `const vaultRoot = useAppStore.getState().vaultRoot;` → return if none.
   - Return if the transcript has no `user_message` (nothing worth persisting).
   - Lazily assign identity: if `chatId` is `null`, `chatId = newChatId()`, `createdAt = now`
     (`new Date().toISOString()`), `set({ chatId, createdAt })`.
   - Build `ChatFile`: `meta = { schema: CHAT_FILE_SCHEMA, id: chatId, title: state.title ||
     deriveChatTitle(state.items), model: state.modelId, created: createdAt ?? now, updated: now }`,
     `items: state.items`.
   - `await chatsService.saveChat(chatId, serializeChatFile(file))` in a try/catch; on failure
     `useToastStore.getState().showToast(\`Could not save chat: ${msg}\`, 'error')`.

4. **`newChat`** — stop any running backend (as `setModel` does: `getBackend(getModel(modelId)?.
   engine)?.stop()` when `sessionStarted`), then `set({ items: [], chatId: null, title: '',
   createdAt: null, turnActive: false, sessionStarted: false, pendingResume: false })`.

5. **`loadChat(file)`** — stop any running backend; resolve the file's model
   (`getModel(file.meta.model)`, keep current `modelId` if unknown); `set({ items: file.items,
   chatId: file.meta.id, title: file.meta.title, createdAt: file.meta.created || null, modelId:
   model?.id ?? state.modelId, turnActive: false, sessionStarted: false, pendingResume:
   countMessages(file.items) > 0 })`. Also `useAppStore.getState().openChat()` so a loaded chat is
   shown. (Pure state swap — no I/O.)

6. **`loadChatById(id)`** — `const raw = await chatsService.readChat(id); const res =
   parseChatFile(raw); if (!res.ok) { showToast(res.error, 'error'); return; } get().loadChat(res.
   file);` wrapped in try/catch (read rejection → error toast). The convenient path the future
   history list calls.

7. **Rework `setModel`** — after the existing stop + `set`, also set `pendingResume` true when the
   thread already has conversational history, so switching the model replays owned history to the
   new engine: `set({ modelId, sessionStarted: false, turnActive: false, pendingResume:
   countMessages(state.items) > 0 })`.

8. **Rework `sendMessage`** — after appending the `user_message` and setting `turnActive`:
   - `void get().persistCurrentChat();` (durably capture the question).
   - Session start unchanged (vault check + `backend.start`), but the `onEvent` closure gains a
     save trigger: after `set((s) => applyAgentEvent(s, event))`, if `event.type === 'turn_done' ||
     event.type === 'error'` then `void get().persistCurrentChat()` (durably capture the result).
   - Choose the prompt: `let prompt = trimmed; if (get().pendingResume) { const history =
     get().items.slice(0, -1); prompt = buildResumePrompt(history, trimmed); set({ pendingResume:
     false }); }` then `await backend.send(prompt)`.
   - In the `catch`, after adding the error item, `void get().persistCurrentChat()`.

9. **`ChatPanel` "New chat" button** — `src/components/layout/ChatPanel.tsx`.
   - `const newChat = useChatStore((s) => s.newChat);`
   - Replace the empty reserved band `<div className="h-[calc(var(--rail-fab)_+_var(--space-8))]
     shrink-0" />` with the same-height band containing a left-aligned `<Button variant="quiet"
     size="sm" onClick={newChat}>New chat</Button>` (import `Button` from `@/components/ui/button`),
     padded left and kept clear of the top-right FAB.

10. **Update `.agents/ubiquitous-language.md`** — extend the `Chat store` (`useChatStore`) entity
    (now owns thread identity + persistence + resume), add a Relationships bullet (store now imports
    `chat-file`/`chat-prompt`/`chatsService` runtime; saves on every turn; replays on the resume
    boundary), bump "Last updated", append a Changelog row.

## Architecture Decisions

- **Resume on the boundary, raw text when live.** Honors #69's explicit design (`buildResumePrompt`
  is "first continued turn only"); avoids double-feeding context the CLI already holds. The store
  becomes the durable owner of history without changing the `AgentBackend` contract.
- **Model switch now replays history.** Because the store owns history, switching engines mid-thread
  can carry context across — a real capability the pre-#70 store couldn't offer (it had no history
  to replay). Implemented by reusing the same `pendingResume` boundary flag.
- **Lazy, filename-safe id.** No id until there's something to save; `chat-<epochMs>-<seq>` is safe
  under Rust `is_safe_id` and every OS filesystem. The store owns id/timestamp generation (runtime
  code — the clock/purity ban only applies to the pure `chat-file`/`chat-prompt` libs).
- **Best-effort save, never blocks a turn.** Persistence failures degrade to a toast (the
  `useSaveLoop` precedent); the conversation keeps working in memory.
- **Minimal UI, store-complete API.** "New chat" makes the multi-thread behavior observable now;
  `loadChat`/`loadChatById` are shipped so the later history-list UI is a pure UI slice.

## Validation Criteria

- [x] `pnpm build` (tsc + Vite) passes — no import cycle, store + panel typecheck (124 modules).
- [x] `pnpm check` (Biome lint + format) passes (77 files, no fixes).
- [x] Sending a turn writes `<vault>/.orbit/chats/<id>.chat.md`; a follow-up turn overwrites it with
      an updated `updated` timestamp and the full transcript (reasoned through against `chats.rs` +
      `chat-file.ts`; Rust unchanged — no test runner, verified by code inspection).
- [x] "New chat" clears the transcript and starts a fresh thread (new id on next save); the prior
      thread remains on disk (code-verified: `newChat` resets `chatId`/`items`, save on disk untouched).
- [x] `loadChat`/`loadChatById` swaps the transcript, opens the chat, and the **first** subsequent
      turn sends a `buildResumePrompt` (replayed `You:`/`Assistant:` context) while later turns send
      raw text; a live (unswitched) session never replays (code-verified via the `pendingResume` flag).
- [x] Switching the model mid-thread replays the owned history to the new engine on the next turn
      (code-verified: `setModel` sets `pendingResume` when `countMessages > 0`).
- [x] Existing consumers unaffected: `ChatPanel` (items/turnActive/sendMessage), `SettingsDialog`
      (setModel), `use-settings-bootstrap` (sessionStarted/setModel) still compile and behave.
- [x] Ubiquitous-language glossary updated + "Last updated" bumped + Changelog row added.

## Open Questions

None. The history-browse list UI (the visual entry point that calls `loadChat`), token-budget
truncation, and per-chat rename/delete UI are deliberately out of scope — later epic-#66 slices that
consume the `loadChat`/`loadChatById`/`persistCurrentChat` API and `chatsService.listChats`/
`deleteChat` this slice leaves in place.
