import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatRecord } from '@/services/chats.service';
import { chatsService } from '@/services/chats.service';
import { useAppStore } from './app-store';
import { useChatHistoryStore } from './chat-history-store';
import { useChatStore } from './chat-store';
import { useToastStore } from './toast-store';

vi.mock('@/services/chats.service', () => ({
  chatsService: {
    saveChat: vi.fn(),
    readChat: vi.fn(),
    listChats: vi.fn(),
    deleteChat: vi.fn(),
  },
}));

function chatFileContents(id: string, title: string): string {
  return [
    '---',
    'schema: 1',
    `id: "${id}"`,
    `title: "${title}"`,
    'model: "sonnet-5"',
    'created: "2026-01-01T00:00:00.000Z"',
    'updated: "2026-01-02T00:00:00.000Z"',
    '---',
    '',
  ].join('\n');
}

function record(id: string, title = id): ChatRecord {
  return { id, path: `/vault/.orbit/chats/${id}.chat.md`, updatedMs: 0, contents: chatFileContents(id, title) };
}

const initialHistoryState = useChatHistoryStore.getState();
const initialChatState = useChatStore.getState();
const initialAppState = useAppStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useChatHistoryStore.setState(initialHistoryState, true);
  useChatStore.setState(initialChatState, true);
  useAppStore.setState(initialAppState, true);
});

describe('setTab', () => {
  it('switches the active tab', () => {
    useChatHistoryStore.getState().setTab('history');
    expect(useChatHistoryStore.getState().tab).toBe('history');
  });
});

describe('refresh', () => {
  it('loads records and defaults the cursor to the first (newest) row', async () => {
    vi.mocked(chatsService.listChats).mockResolvedValue([record('chat-2'), record('chat-1')]);

    await useChatHistoryStore.getState().refresh();

    const state = useChatHistoryStore.getState();
    expect(state.loading).toBe(false);
    expect(state.records.map((r) => r.id)).toEqual(['chat-2', 'chat-1']);
    expect(state.cursorId).toBe('chat-2');
  });

  it('keeps the cursor on the same chat if it survives the refresh', async () => {
    vi.mocked(chatsService.listChats).mockResolvedValue([record('chat-2'), record('chat-1')]);
    await useChatHistoryStore.getState().refresh();
    useChatHistoryStore.getState().setCursor('chat-1');

    vi.mocked(chatsService.listChats).mockResolvedValue([record('chat-3'), record('chat-1')]);
    await useChatHistoryStore.getState().refresh();

    expect(useChatHistoryStore.getState().cursorId).toBe('chat-1');
  });

  it('falls back to the top row when the cursored chat disappeared', async () => {
    vi.mocked(chatsService.listChats).mockResolvedValue([record('chat-2'), record('chat-1')]);
    await useChatHistoryStore.getState().refresh();
    useChatHistoryStore.getState().setCursor('chat-1');

    vi.mocked(chatsService.listChats).mockResolvedValue([record('chat-3')]);
    await useChatHistoryStore.getState().refresh();

    expect(useChatHistoryStore.getState().cursorId).toBe('chat-3');
  });

  it('sets cursorId to null for an empty list', async () => {
    vi.mocked(chatsService.listChats).mockResolvedValue([]);

    await useChatHistoryStore.getState().refresh();

    expect(useChatHistoryStore.getState().cursorId).toBeNull();
    expect(useChatHistoryStore.getState().records).toEqual([]);
  });

  it('shows an error toast and clears loading when the fetch rejects', async () => {
    vi.mocked(chatsService.listChats).mockRejectedValue(new Error('offline'));
    const toastSpy = vi.spyOn(useToastStore.getState(), 'showToast');

    await useChatHistoryStore.getState().refresh();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('offline'), 'error');
    expect(useChatHistoryStore.getState().loading).toBe(false);
  });
});

describe('setCursor / moveCursor', () => {
  beforeEach(() => {
    useChatHistoryStore.setState({ records: [record('chat-1'), record('chat-2'), record('chat-3')], cursorId: null });
  });

  it('setCursor sets the cursor directly', () => {
    useChatHistoryStore.getState().setCursor('chat-2');
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-2');
  });

  it('moveCursor(1) with no cursor enters at the top row', () => {
    useChatHistoryStore.getState().moveCursor(1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-1');
  });

  it('moveCursor(-1) with no cursor enters at the bottom row', () => {
    useChatHistoryStore.getState().moveCursor(-1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-3');
  });

  it('moveCursor steps forward and clamps at the last row', () => {
    useChatHistoryStore.getState().setCursor('chat-1');
    useChatHistoryStore.getState().moveCursor(1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-2');
    useChatHistoryStore.getState().moveCursor(1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-3');
    useChatHistoryStore.getState().moveCursor(1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-3');
  });

  it('moveCursor steps backward and clamps at the first row', () => {
    useChatHistoryStore.getState().setCursor('chat-3');
    useChatHistoryStore.getState().moveCursor(-1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-2');
    useChatHistoryStore.getState().moveCursor(-1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-1');
    useChatHistoryStore.getState().moveCursor(-1);
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-1');
  });

  it('is a no-op on an empty list', () => {
    useChatHistoryStore.setState({ records: [], cursorId: null });
    useChatHistoryStore.getState().moveCursor(1);
    expect(useChatHistoryStore.getState().cursorId).toBeNull();
  });
});

describe('open', () => {
  it('loads the matching record into the chat store and switches to the Chat tab', () => {
    useChatHistoryStore.setState({ records: [record('chat-1', 'My saved thread')], tab: 'history' });

    useChatHistoryStore.getState().open('chat-1');

    expect(useChatStore.getState().chatId).toBe('chat-1');
    expect(useChatStore.getState().title).toBe('My saved thread');
    expect(useChatHistoryStore.getState().tab).toBe('chat');
    expect(useChatHistoryStore.getState().cursorId).toBe('chat-1');
    expect(useAppStore.getState().chatOpen).toBe(true);
  });

  it('does nothing for an id not present in records', () => {
    useChatHistoryStore.setState({ records: [record('chat-1')], tab: 'history' });

    useChatHistoryStore.getState().open('missing');

    expect(useChatHistoryStore.getState().tab).toBe('history');
    expect(useChatStore.getState().chatId).toBeNull();
  });

  it('shows an error toast and stays on the current tab when the record fails to parse', () => {
    useChatHistoryStore.setState({ records: [{ id: 'chat-1', path: 'x', updatedMs: 0, contents: 'not a chat file' }], tab: 'history' });
    const toastSpy = vi.spyOn(useToastStore.getState(), 'showToast');

    useChatHistoryStore.getState().open('chat-1');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Could not open chat'), 'error');
    expect(useChatHistoryStore.getState().tab).toBe('history');
    expect(useChatStore.getState().chatId).toBeNull();
  });
});

describe('openCursor', () => {
  it('opens the chat under the cursor', () => {
    useChatHistoryStore.setState({ records: [record('chat-1', 'Cursored thread')], cursorId: 'chat-1', tab: 'history' });

    useChatHistoryStore.getState().openCursor();

    expect(useChatStore.getState().chatId).toBe('chat-1');
    expect(useChatHistoryStore.getState().tab).toBe('chat');
  });

  it('is a no-op when there is no cursor', () => {
    useChatHistoryStore.setState({ records: [], cursorId: null, tab: 'history' });

    useChatHistoryStore.getState().openCursor();

    expect(useChatHistoryStore.getState().tab).toBe('history');
    expect(useChatStore.getState().chatId).toBeNull();
  });
});
