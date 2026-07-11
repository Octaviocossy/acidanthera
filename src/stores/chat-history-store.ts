import { create } from 'zustand';
import { parseChatFile } from '@/lib/chat/chat-file';
import { type ChatRecord, chatsService } from '@/services/chats.service';
import { useChatStore } from './chat-store';
import { useToastStore } from './toast-store';

/** Which surface the chat panel shows: the live transcript or the saved-chat browser (#71). */
export type ChatTab = 'chat' | 'history';

interface ChatHistoryState {
  /** The chat panel's active tab (#71). `'chat'` = live transcript, `'history'` = saved-chat list. */
  tab: ChatTab;
  /** The saved conversations, newest-first, as returned by `chatsService.listChats` (raw `contents`
   *  each — parsed for display by `ChatHistoryList`, never here; this store stays format-agnostic). */
  records: ChatRecord[];
  /** True while a `listChats` fetch is in flight (drives the History tab's loading placeholder). */
  loading: boolean;
  /** Id of the row the vim cursor sits on; `null` when the list is empty. Mirrors `useSidebarStore.cursorPath`. */
  cursorId: string | null;

  setTab: (tab: ChatTab) => void;
  /** Fetches the saved-chat list and reconciles the cursor (keeps it if still present, else the top row). Best-effort → error toast. */
  refresh: () => Promise<void>;
  setCursor: (id: string) => void;
  /** Moves the cursor one row down (`1`) or up (`-1`), clamped to the list bounds. */
  moveCursor: (delta: 1 | -1) => void;
  /** Loads the saved chat with `id` into the transcript and switches to the Chat tab; parse error → toast. */
  open: (id: string) => void;
  /** {@link open}s the chat under the cursor (the `l`/`Enter` action of {@link useChatHistoryKeymap}). */
  openCursor: () => void;
}

/**
 * View state for the chat panel's History tab (#71, epic #66). Holds only browser state — the active
 * tab, the fetched `ChatRecord` list, the vim cursor — never the transcript itself (that stays in
 * `useChatStore`). It mirrors the sidebar's list triad: this store is `useSidebarStore`, the keymap
 * hook is `useChatHistoryKeymap`, and `ChatHistoryList` is the presentational list. It parses a
 * record only to *open* it (via `useChatStore.loadChat`); title/model display parsing lives in the
 * list component, so the store stays format-agnostic like `chatsService`.
 */
export const useChatHistoryStore = create<ChatHistoryState>((set, get) => ({
  tab: 'chat',
  records: [],
  loading: false,
  cursorId: null,

  setTab: (tab) => set({ tab }),

  refresh: async () => {
    set({ loading: true });
    try {
      const records = await chatsService.listChats();
      // Keep the cursor on the same chat if it survived the refresh; otherwise fall to the top row.
      const cursorId = records.some((record) => record.id === get().cursorId) ? get().cursorId : (records[0]?.id ?? null);
      set({ records, cursorId, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast(`Could not load chat history: ${message}`, 'error');
      set({ loading: false });
    }
  },

  setCursor: (id) => set({ cursorId: id }),

  moveCursor: (delta) => {
    const { records, cursorId } = get();
    if (records.length === 0) return;
    const index = records.findIndex((record) => record.id === cursorId);
    // No current cursor → enter from the top (down) or bottom (up); otherwise step and clamp.
    const nextIndex = index === -1 ? (delta > 0 ? 0 : records.length - 1) : Math.min(Math.max(index + delta, 0), records.length - 1);
    set({ cursorId: records[nextIndex].id });
  },

  open: (id) => {
    const record = get().records.find((r) => r.id === id);
    if (!record) return;
    const result = parseChatFile(record.contents);
    if (!result.ok) {
      useToastStore.getState().showToast(`Could not open chat: ${result.error}`, 'error');
      return;
    }
    // `loadChat` swaps the transcript and calls `useAppStore.openChat()`; land the user on the Chat tab.
    useChatStore.getState().loadChat(result.file);
    set({ tab: 'chat', cursorId: id });
  },

  openCursor: () => {
    const { cursorId } = get();
    if (cursorId) get().open(cursorId);
  },
}));
