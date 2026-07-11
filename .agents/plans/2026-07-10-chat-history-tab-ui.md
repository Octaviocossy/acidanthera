# Plan: Chat History tab UI (two-tab panel, list, new chat, j/k)

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #71 (epic #66 — chat management & history)

## Goal

Give the chat panel a **two-tab surface** — *Chat* (the live transcript, unchanged) and
*History* (a keyboard-navigable list of saved conversations) — plus a *New chat* control. The
History tab consumes the API #70 left in place (`useChatStore.loadChat` / `chatsService.listChats`)
so a user can browse `.orbit/chats/` and switch back into any saved thread, driven by vim `j`/`k`.

## Context

- **What exists today:**
  - `useChatStore` (`src/stores/chat-store.ts`, #70) owns durable multi-thread history:
    `newChat()`, `loadChat(file: ChatFile)`, `loadChatById(id)`, `persistCurrentChat()`. Every turn
    auto-saves to `<vault>/.orbit/chats/<id>.chat.md`. `loadChat` already calls
    `useAppStore.openChat()`.
  - `chatsService` (`src/services/chats.service.ts`, #68) exposes `listChats(): Promise<ChatRecord[]>`
    (newest-first; each record carries the **raw** `contents` markdown), `readChat`, `saveChat`,
    `deleteChat`. `ChatRecord = { id, path, updatedMs, contents }`.
  - `chat-file.ts` (#67) `parseChatFile(raw)` → `{ ok, file }`; `deriveChatTitle(items)`.
  - `ChatPanel` (`src/components/layout/ChatPanel.tsx`) renders a single transcript + `ChatInput`,
    with a reserved top band already holding a lone "New chat" `Button` (#70).
  - The vim-list precedent is the sidebar: `useSidebarStore` (cursor state) + `useSidebarKeymap`
    (`src/hooks/use-sidebar-keymap.ts`, window-level `j`/`k`/`l`/`Enter`, scoped to
    `activeRegion === 'sidebar' && mode === 'normal'`, `isEditableTarget`-guarded) + `FileTreeItem`
    (row with a `cursor` inset bar).
  - `useAppStore.activeRegion` gates region-scoped keymaps. `openChat()` sets `chatOpen` but **not**
    `activeRegion` — so the History UI must call `focusRegion('chat')` on interaction for `j`/`k`
    to become live (exactly as the sidebar rows call `focusRegion('sidebar')`).
- **What prompted this:** epic #66. #70 shipped the store API + persistence and explicitly deferred
  "the full history-browse list UI (the visual entry point that calls `loadChat`)" to a later slice.
  #71 is that slice.
- **Constraints / decisions:**
  - **Mirror the sidebar's list pattern** (store for cursor + a window keymap hook + a presentational
    list), not a bespoke one-off — consistency over novelty.
  - **The store holds only view state** (`tab`, `records`, `cursorId`, `loading`). Parsing a record's
    `contents` for title/model happens in the list component (memoized), keeping the store
    format-agnostic like `chatsService`.
  - **Open via `loadChat(parsed)`**, not `loadChatById(id)` — the record already carries `contents`,
    so a single `listChats` round-trip is reused (the `ChatRecord.contents` design intent, #68).
  - **Best-effort refresh** — a `listChats` rejection degrades to a `useToastStore` error toast (the
    `useSaveLoop`/`persistCurrentChat` precedent), never throws into render.
  - **Delete/rename UI stays out of scope** — #70 reserved it for a later slice; #71 is browse+open
    only. The title enumerates the scope: *two-tab panel, list, new chat, j/k*.
  - **No test runner** (`AGENTS.md`); verified by `pnpm lint` + `pnpm build` and reasoning over the
    load/refresh/keymap paths.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/stores/chat-history-store.ts` | `useChatHistoryStore`: `tab`/`records`/`cursorId`/`loading` + `setTab`/`refresh`/`setCursor`/`moveCursor`/`open`/`openCursor` |
| CREATE | `src/hooks/use-chat-history-keymap.ts` | Window `j`/`k`/`l`/`Enter` keymap over the History list, scoped to the active chat region + History tab |
| CREATE | `src/components/ai/ChatHistoryList.tsx` | The History tab's list of `ChatRecord` rows (cursor + active highlight, empty/loading states, click-to-open) |
| MODIFY | `src/components/layout/ChatPanel.tsx` | Two-tab strip (Chat/History) + New chat; render transcript+input or history list by tab; mount the keymap |
| MODIFY | `.agents/ubiquitous-language.md` | Add the new entities; bump "Last updated"; Changelog row |
| CREATE | `.agents/plans/2026-07-10-chat-history-tab-ui.md` | This plan |

## Step-by-Step Implementation

1. **Create `src/stores/chat-history-store.ts`.**
   - Imports: `create` from `zustand`; `parseChatFile` from `@/lib/chat/chat-file`; `{ type ChatRecord, chatsService }` from `@/services/chats.service`; `useChatStore` from `./chat-store`; `useToastStore` from `./toast-store`; `useAppStore` from `./app-store`.
   - `export type ChatTab = 'chat' | 'history'`.
   - `ChatHistoryState`: `tab: ChatTab`, `records: ChatRecord[]`, `loading: boolean`, `cursorId: string | null`; actions `setTab(tab)`, `refresh(): Promise<void>`, `setCursor(id: string)`, `moveCursor(delta: 1 | -1)`, `open(id: string)`, `openCursor()`.
   - `refresh`: `set({ loading: true })`; `try { const records = await chatsService.listChats(); const cursorId = records.some(r => r.id === get().cursorId) ? get().cursorId : records[0]?.id ?? null; set({ records, cursorId, loading: false }); } catch (err) { toast error; set({ loading: false }); }`.
   - `moveCursor`: find index of `cursorId` in `records`; clamp `index + delta` to `[0, len-1]`; on no cursor default to the first (delta>0) or last row; `set({ cursorId })`.
   - `open(id)`: find record; `parseChatFile(record.contents)`; on `!ok` → toast; else `useChatStore.getState().loadChat(result.file)` then `set({ tab: 'chat', cursorId: id })`.
   - `openCursor()`: if `cursorId` → `get().open(cursorId)`.
   - Initial: `{ tab: 'chat', records: [], loading: false, cursorId: null }`.

2. **Create `src/hooks/use-chat-history-keymap.ts`.**
   - Mirror `useSidebarKeymap`: `useEffect` registering a `window` `keydown` in the bubble phase.
   - Guard: `const app = useAppStore.getState(); if (app.activeRegion !== 'chat' || app.mode !== 'normal') return;` then `if (event.ctrlKey || event.metaKey || event.altKey) return;` then `if (isEditableTarget(event.target)) return;` then `const h = useChatHistoryStore.getState(); if (h.tab !== 'history') return;`.
   - `j` → `preventDefault` + `h.moveCursor(1)`; `k` → `moveCursor(-1)`; `l` / `Enter` → `preventDefault` + `h.openCursor()`.

3. **Create `src/components/ai/ChatHistoryList.tsx`.**
   - Props: none. Reads `records`, `cursorId`, `loading`, `open`, `setCursor`, `refresh` from `useChatHistoryStore`; `activeChatId = useChatStore(s => s.chatId)`; `focusRegion = useAppStore(s => s.focusRegion)`.
   - `useEffect(() => { void refresh(); }, [refresh])` — refresh whenever the list mounts (i.e. each time the History tab is shown).
   - Memoize a view model per record: `useMemo(() => records.map(toRowVM), [records])` where `toRowVM(r)` parses `r.contents` once → `{ id, title, modelLabel, updatedMs }` (title = `meta.title || deriveChatTitle(file.items)`, model label via `getModel(meta.model)?.label ?? meta.model`; on parse failure fall back to `{ id, title: r.id, modelLabel: '—' }`).
   - Row (`<button>` for a11y + native click/focus): `onClick={() => { focusRegion('chat'); open(vm.id); }}`, `onMouseEnter`/focus optional; cursor bar `absolute inset-y-0 left-0 w-0.5 bg-border-active` when `vm.id === cursorId`; `bg-surface-2` when `vm.id === activeChatId`. Shows title (truncate) + a muted meta line `modelLabel · <relative time>`.
   - Scroll the cursored row into view: give each row `data-cursor={vm.id === cursorId}`; `useEffect(() => containerRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' }), [cursorId])`.
   - States: `loading && records.length === 0` → muted "Loading…"; `!loading && records.length === 0` → muted "No saved chats yet."; else the rows.
   - `formatRelative(ms, now)` helper (just now / `Nm` / `Nh` / `Nd` / locale date).

4. **Modify `src/components/layout/ChatPanel.tsx`.**
   - Mount `useChatHistoryKeymap()` at the top (before the `if (!chatOpen) return null`), mirroring `Sidebar`.
   - Read `tab`, `setTab` from `useChatHistoryStore`; `focusRegion` from `useAppStore`.
   - Replace the current single "New chat" band with a header band that holds a `role="tablist"`: two `role="tab"` buttons (Chat / History) left-aligned + a "New chat" button, all kept clear of the top-right FAB. Tab click → `focusRegion('chat')` + `setTab(...)`. New chat → `focusRegion('chat')` + `useChatStore.newChat()` + `setTab('chat')`.
   - Body: when `tab === 'chat'` render the existing transcript list + `ThinkingIndicator` + `ChatInput`; when `tab === 'history'` render `<ChatHistoryList />`.

5. **Update `.agents/ubiquitous-language.md`** — add `Chat history store`, `Chat history keymap`, `ChatHistoryList`, `Chat tab` entities; a Relationships bullet (history store reads `chatsService.listChats`, opens via `useChatStore.loadChat`, focuses the chat region); bump "Last updated"; append a Changelog row.

## Architecture Decisions

- **Reuse the sidebar's list triad** (cursor store + window keymap hook + presentational list). A
  reviewer already knows this shape; a chat-specific reinvention would drift.
- **View state in its own store, not `useChatStore`.** The transcript store owns the *active
  conversation*; the browser owns *which saved conversations exist and which row is highlighted*.
  Keeping them separate avoids polluting the send/persist path with list state.
- **Open from the already-fetched `contents`.** `listChats` returns each record's raw markdown
  precisely so the browser needs no second read (#68 design); `open` parses locally and calls
  `loadChat`, not `loadChatById`.
- **Interaction focuses the chat region.** `openChat()` doesn't set `activeRegion`, so tab/row/New-chat
  clicks call `focusRegion('chat')` — the same contract the sidebar rows honor — making `j`/`k` live.
- **Refresh on mount, not on a subscription.** The list is only mounted while the History tab is
  visible, so a remount-driven `refresh()` always shows the latest saves with no watcher wiring.

## Validation Criteria

- [x] `pnpm build` (tsc + Vite) passes — no import cycle (store→lib runtime edge only); 127 modules (was 124).
- [x] `pnpm lint` / `pnpm check` (Biome, 80 files) passes — no fixes applied.
- [x] Opening the chat shows two tabs; *Chat* renders the live transcript + input unchanged (code-verified — the Chat branch is the pre-#71 body verbatim).
- [x] *History* lists saved chats newest-first (title + model + relative time); empty vault → "No saved chats yet." (code-verified against `chatsService.listChats` newest-first + `ChatHistoryList` render branches).
- [x] `j`/`k` move the cursor (scoped to active chat region + History tab), `l`/`Enter` open the highlighted chat, switching to the *Chat* tab (`open` → `useChatStore.loadChat`, which flags `pendingResume`, so the next turn resumes) — code-verified.
- [x] Clicking a row opens it; clicking a tab switches views and focuses the chat region (all handlers call `focusRegion('chat')`).
- [x] *New chat* clears the transcript to a fresh thread and lands on the *Chat* tab (`newChat()` + `setTab('chat')`).
- [x] Ubiquitous-language glossary updated + "Last updated" bumped + Changelog row added.

_No test runner is configured (`AGENTS.md`); interactive behaviors are verified by reasoning over the
code paths, as the acceptance bar for this repo is `pnpm lint` + `pnpm build` (both green)._

## Open Questions

None. Per-chat delete/rename UI is intentionally out of scope (a later epic-#66 slice, per #70's
note); this slice is browse + open only, matching the issue title.
