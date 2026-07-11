# Plan: Epic — Chat management & history

> Status: **draft**
> Created: 2026-07-10
> Issue: #66
> Integration branch: epic/66-chat-management-history

## Goal

Make the AI chat global and multi-thread — many chats the user can switch between, each
persisted as a JSONL file under `<vault>/.orbit/chats/`, with Orbit owning the conversation
history (stateless CLI re-send of a truncated transcript each turn, never `--resume`) and a new
History tab to browse and load past chats. Backend-agnostic: a chat can switch engines mid-thread
because history is ours and re-sent.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #67 | `67-chat-file-format-contract` | feat: chat-file format contract & serialization | pending |
| 2 | #68 | `68-chat-persistence-orbit-store` | feat: chat persistence — `.orbit/chats` Rust store & service | pending |
| 2 | #69 | `69-chat-prompt-building-truncation` | feat: chat prompt building & message-count truncation | pending |
| 3 | #70 | `70-multi-thread-chat-store` | feat: multi-thread chat store & stateless owns-history turns | pending |
| 4 | #71 | `71-chat-history-tab-ui` | feat: chat History tab UI (two-tab panel, list, new chat, j/k) | pending |

## Dependency Edges

```
68 -> 67
69 -> 67
70 -> 68
70 -> 69
71 -> 70
```

## Slice summary

- **#67 (foundation, wave 1)** — `src/lib/chat/chat-file.ts`: the JSONL schema (header + user/agent
  entries + light `ToolCallRecord[]`) and pure serialize/parse helpers. Shared contract root; new
  files only, no deps. Reuses `AgentSource` from `agent-event.ts`.
- **#68 (persistence, wave 2, dep #67)** — Rust `src-tauri/src/chat.rs` (`chat_list`/`chat_read`/
  `chat_write` over `<vault>/.orbit/chats/`, schema-agnostic: raw lines + line count) + registration
  in `lib.rs` + `pub(crate)` expose of `current_root` in `vault.rs` + `chatFileService`. `.orbit/`
  is already hidden from the sidebar by `build_tree`'s dotfile skip (add a regression test).
- **#69 (prompt logic, wave 2, dep #67)** — `src/lib/chat/truncate.ts` (message-count, `maxEntries`)
  + `build-prompt.ts` (`buildTurnPrompt` renders truncated turns + compact tool-call structs into the
  single stateless prompt). Pure, new files only. Parallel to #68 (disjoint files).
- **#70 (store + backends, wave 3, dep #68, #69)** — rewrite `useChatStore` (multi-thread,
  owns-history turn flow) and convert both backends to a stateless `runTurn` (replaces
  `AgentBackend.start`/`send`; Claude Code one-shot `claude -p <prompt>`, Codex `codex exec` with no
  resume/threadId). Owns store + all backend files together (the interface's only consumer is the
  store), so no half-built interface and no cross-slice file overlap. Adds `use-chat-bootstrap` +
  mounts it in `App.tsx`.
- **#71 (History UI, wave 4, dep #70)** — two-tab `ChatPanel` (Chat/History) + `ChatHistoryList`/
  `ChatHistoryRow` + `use-chat-history-keymap` (`j`/`k`/`Enter`, scoped like `use-sidebar-keymap`).
  Pure UI over #70's store (tab/cursor/list state provisioned by #70), so it touches only UI files.

## Architecture invariants

- Frontend (`chat-file.ts`) owns the JSONL schema; Rust (`chat.rs`) stays schema-agnostic (bytes +
  line counts only), so the format is defined once.
- `entries` (persisted `ChatEntry[]`) is the file source of truth; `items` (`ChatItem[]`) is a derived
  render model rebuilt on load and updated live during a turn.
- Stateless turns: every turn spawns a fresh CLI process fed the full truncated transcript; no
  `--resume`, no long-lived agent process. This is what makes history portable and backend-agnostic.
- Stable instructions live in `CLAUDE.md`/`AGENTS.md` (untruncated), never in the chat prompt.
- `chatId` via `crypto.randomUUID()` (no `uuid` crate in `src-tauri/Cargo.toml`).
- Full-file overwrite per turn (`chat_write`) — simplest correct persistence for v0 sizes.

## Out of scope (v0)

Rename/delete/search of chats; token-budget truncation (message-count only); delta streaming; the
CLI's native `--resume`/session store.

## Open Questions

- Title: v0 sets a chat's title once from its first user message (no rename UI). Header keeps an
  editable `title` for v1.
- Boot behavior: #70 starts on an empty thread (chats listed in History, not auto-loaded). Revisit if
  auto-loading the most-recent chat reads better.
- `DEFAULT_MAX_ENTRIES` = 40 (sane default; tune later). `maxEntries` is a function arg, not yet a
  persisted Setting.
