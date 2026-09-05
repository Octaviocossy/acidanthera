import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentBackend } from '@/lib/agent/agent-backend';
import type { AgentEvent, AgentSource } from '@/lib/agent/agent-event';
import { registerBackend } from '@/lib/agent/backend-registry';
import { chatsService } from '@/services/chats.service';
import { useAppStore } from './app-store';
import type { ChatItem } from './chat-store';
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

type FakeBackend = AgentBackend & { emit: (event: AgentEvent) => void };

function fakeBackend(id: AgentSource): FakeBackend {
  let handler: ((event: AgentEvent) => void) | null = null;
  return {
    id,
    label: id,
    start: vi.fn(async (_cwd: string, _model: string, onEvent: (event: AgentEvent) => void) => {
      handler = onEvent;
    }),
    send: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    emit: (event) => handler?.(event),
  };
}

function baseEvent(source: AgentSource) {
  return { timestamp: 0, source };
}

const initialChatState = useChatStore.getState();
const initialAppState = useAppStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState(initialChatState, true);
  useAppStore.setState(initialAppState, true);
});

describe('setModel', () => {
  it('is a no-op when setting the current model', () => {
    const before = useChatStore.getState();
    useChatStore.getState().setModel(before.modelId);
    expect(useChatStore.getState()).toBe(before);
  });

  it('switches modelId and resets session flags', () => {
    useChatStore.getState().setModel('sonnet-5');
    const state = useChatStore.getState();
    expect(state.modelId).toBe('sonnet-5');
    expect(state.sessionStarted).toBe(false);
    expect(state.turnActive).toBe(false);
  });

  it('flags pendingResume only when there is prior conversation', () => {
    useChatStore.getState().setModel('sonnet-5');
    expect(useChatStore.getState().pendingResume).toBe(false);

    useChatStore.setState({ modelId: 'gpt-5.4-mini', items: [{ kind: 'user_message', id: 'u-1', text: 'hi' } satisfies ChatItem] });
    useChatStore.getState().setModel('sonnet-5');
    expect(useChatStore.getState().pendingResume).toBe(true);
  });

  it('stops the previous model backend when a session was running', () => {
    const backend = fakeBackend('codex');
    registerBackend(backend);
    useChatStore.setState({ sessionStarted: true, modelId: 'gpt-5.4-mini' });

    useChatStore.getState().setModel('sonnet-5');

    expect(backend.stop).toHaveBeenCalledOnce();
  });
});

describe('sendMessage', () => {
  it('ignores blank input', async () => {
    await useChatStore.getState().sendMessage('   ');
    expect(useChatStore.getState().items).toEqual([]);
  });

  it('ignores input while a turn is already active', async () => {
    useChatStore.setState({ turnActive: true });
    await useChatStore.getState().sendMessage('hello');
    expect(useChatStore.getState().items).toEqual([]);
  });

  it('records an error and never starts the backend when no vault is open', async () => {
    useAppStore.getState().setVaultRoot(null);
    const backend = fakeBackend('codex'); // engine of the default model, gpt-5.4-mini
    registerBackend(backend);

    await useChatStore.getState().sendMessage('hello');

    const state = useChatStore.getState();
    expect(state.turnActive).toBe(false);
    expect(state.items.some((item) => item.kind === 'error' && item.message.includes('Open a vault'))).toBe(true);
    expect(backend.start).not.toHaveBeenCalled();
  });

  it('starts the backend, sends the raw text, and persists the user turn', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    const backend = fakeBackend('codex');
    registerBackend(backend);
    vi.mocked(chatsService.saveChat).mockResolvedValue('/vault/.acidanthera/chats/x.chat.md');

    await useChatStore.getState().sendMessage('hello');

    expect(backend.start).toHaveBeenCalledOnce();
    expect(backend.send).toHaveBeenCalledWith('hello');
    expect(useChatStore.getState().sessionStarted).toBe(true);
    expect(useChatStore.getState().items[0]).toMatchObject({ kind: 'user_message', text: 'hello' });
    expect(chatsService.saveChat).toHaveBeenCalled();
  });

  it('reuses an already-started session without calling backend.start again', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    const backend = fakeBackend('codex');
    registerBackend(backend);
    vi.mocked(chatsService.saveChat).mockResolvedValue('x');
    useChatStore.setState({ sessionStarted: true });

    await useChatStore.getState().sendMessage('hello again');

    expect(backend.start).not.toHaveBeenCalled();
    expect(backend.send).toHaveBeenCalledWith('hello again');
  });

  it('replays history via a resume prompt when pendingResume is set, then clears the flag', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    const backend = fakeBackend('codex');
    registerBackend(backend);
    vi.mocked(chatsService.saveChat).mockResolvedValue('x');
    useChatStore.setState({
      items: [
        { kind: 'user_message', id: 'u-0', text: 'earlier question' },
        { kind: 'agent_message', id: 'a-0', text: 'earlier reply' },
      ],
      sessionStarted: true,
      pendingResume: true,
    });

    await useChatStore.getState().sendMessage('follow up');

    expect(backend.send).toHaveBeenCalledOnce();
    const sentPrompt = vi.mocked(backend.send).mock.calls[0][0];
    expect(sentPrompt).toContain('earlier question');
    expect(sentPrompt).toContain('follow up');
    expect(useChatStore.getState().pendingResume).toBe(false);
  });

  it('does not replay history for a live, non-resuming session', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    const backend = fakeBackend('codex');
    registerBackend(backend);
    vi.mocked(chatsService.saveChat).mockResolvedValue('x');
    useChatStore.setState({
      items: [{ kind: 'user_message', id: 'u-0', text: 'earlier question' }],
      sessionStarted: true,
      pendingResume: false,
    });

    await useChatStore.getState().sendMessage('follow up');

    expect(backend.send).toHaveBeenCalledWith('follow up');
  });

  it('records an error item and stops the turn when backend.start throws', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    const backend = fakeBackend('codex');
    vi.mocked(backend.start).mockRejectedValueOnce(new Error('boom'));
    registerBackend(backend);
    vi.mocked(chatsService.saveChat).mockResolvedValue('x');

    await useChatStore.getState().sendMessage('hello');

    const state = useChatStore.getState();
    expect(state.turnActive).toBe(false);
    expect(state.items.some((item) => item.kind === 'error' && item.message.includes('boom'))).toBe(true);
  });

  it('applies emitted agent events and clears turnActive on turn_done', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    const backend = fakeBackend('codex');
    registerBackend(backend);
    vi.mocked(chatsService.saveChat).mockResolvedValue('x');

    await useChatStore.getState().sendMessage('hello');
    backend.emit({ type: 'agent_message', messageId: 'm-1', text: 'hi there', ...baseEvent('codex') });
    backend.emit({ type: 'turn_done', ...baseEvent('codex') });

    const state = useChatStore.getState();
    expect(state.turnActive).toBe(false);
    expect(state.items.some((item) => item.kind === 'agent_message' && item.text === 'hi there')).toBe(true);
  });
});

describe('newChat', () => {
  it('stops the running backend and resets the thread identity + transcript', () => {
    const backend = fakeBackend('codex');
    registerBackend(backend);
    useChatStore.setState({
      items: [{ kind: 'user_message', id: 'u-1', text: 'hi' }],
      chatId: 'chat-1',
      title: 'Old chat',
      createdAt: '2026-01-01T00:00:00.000Z',
      turnActive: true,
      sessionStarted: true,
      pendingResume: true,
    });

    useChatStore.getState().newChat();

    const state = useChatStore.getState();
    expect(backend.stop).toHaveBeenCalledOnce();
    expect(state.items).toEqual([]);
    expect(state.chatId).toBeNull();
    expect(state.title).toBe('');
    expect(state.createdAt).toBeNull();
    expect(state.turnActive).toBe(false);
    expect(state.sessionStarted).toBe(false);
    expect(state.pendingResume).toBe(false);
  });
});

describe('loadChat', () => {
  it('loads a saved thread into the store and opens the chat region', () => {
    const backend = fakeBackend('claude-code');
    registerBackend(backend);
    useChatStore.setState({ sessionStarted: true, modelId: 'sonnet-5' });

    useChatStore.getState().loadChat({
      meta: { schema: 1, id: 'chat-9', title: 'Saved thread', model: 'sonnet-5', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z' },
      items: [{ kind: 'user_message', id: 'u-1', text: 'hi' }],
    });

    const state = useChatStore.getState();
    expect(backend.stop).toHaveBeenCalledOnce();
    expect(state.chatId).toBe('chat-9');
    expect(state.title).toBe('Saved thread');
    expect(state.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(state.items).toHaveLength(1);
    expect(state.sessionStarted).toBe(false);
    expect(state.pendingResume).toBe(true);
    expect(useAppStore.getState().chatOpen).toBe(true);
  });

  it('keeps the current model when the file references an unknown model id', () => {
    useChatStore.setState({ modelId: 'sonnet-5' });

    useChatStore.getState().loadChat({
      meta: { schema: 1, id: 'chat-9', title: '', model: 'does-not-exist' as never, created: '', updated: '' },
      items: [],
    });

    expect(useChatStore.getState().modelId).toBe('sonnet-5');
    expect(useChatStore.getState().pendingResume).toBe(false);
  });
});

describe('loadChatById', () => {
  it('reads, parses, and loads the chat on success', async () => {
    vi.mocked(chatsService.readChat).mockResolvedValue(
      [
        '---',
        'schema: 1',
        'id: "chat-9"',
        'title: "Saved thread"',
        'model: "sonnet-5"',
        'created: "2026-01-01T00:00:00.000Z"',
        'updated: "2026-01-02T00:00:00.000Z"',
        '---',
        '',
      ].join('\n')
    );

    await useChatStore.getState().loadChatById('chat-9');

    expect(chatsService.readChat).toHaveBeenCalledWith('chat-9');
    expect(useChatStore.getState().chatId).toBe('chat-9');
  });

  it('shows an error toast when the stored file fails to parse', async () => {
    vi.mocked(chatsService.readChat).mockResolvedValue('not a valid chat file');
    const toastSpy = vi.spyOn(useToastStore.getState(), 'showToast');

    await useChatStore.getState().loadChatById('chat-9');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Could not open chat'), 'error');
    expect(useChatStore.getState().chatId).toBeNull();
  });

  it('shows an error toast when the read itself rejects', async () => {
    vi.mocked(chatsService.readChat).mockRejectedValue(new Error('not found'));
    const toastSpy = vi.spyOn(useToastStore.getState(), 'showToast');

    await useChatStore.getState().loadChatById('missing');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('not found'), 'error');
  });
});

describe('persistCurrentChat', () => {
  it('does nothing when no vault is open', async () => {
    useAppStore.getState().setVaultRoot(null);
    useChatStore.setState({ items: [{ kind: 'user_message', id: 'u-1', text: 'hi' }] });

    await useChatStore.getState().persistCurrentChat();

    expect(chatsService.saveChat).not.toHaveBeenCalled();
  });

  it('does nothing when the transcript has no user message yet', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    useChatStore.setState({ items: [{ kind: 'agent_message', id: 'a-1', text: 'unsolicited' }] });

    await useChatStore.getState().persistCurrentChat();

    expect(chatsService.saveChat).not.toHaveBeenCalled();
  });

  it('mints a chat id and createdAt on the first save, then keeps them stable', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    vi.mocked(chatsService.saveChat).mockResolvedValue('ok');
    useChatStore.setState({ items: [{ kind: 'user_message', id: 'u-1', text: 'hi' }] });

    await useChatStore.getState().persistCurrentChat();
    const firstId = useChatStore.getState().chatId;
    const firstCreatedAt = useChatStore.getState().createdAt;
    expect(firstId).not.toBeNull();
    expect(firstCreatedAt).not.toBeNull();

    await useChatStore.getState().persistCurrentChat();
    expect(useChatStore.getState().chatId).toBe(firstId);
    expect(useChatStore.getState().createdAt).toBe(firstCreatedAt);
    expect(chatsService.saveChat).toHaveBeenCalledTimes(2);
  });

  it('shows an error toast when the save rejects', async () => {
    useAppStore.getState().setVaultRoot('/vault');
    vi.mocked(chatsService.saveChat).mockRejectedValue(new Error('disk full'));
    const toastSpy = vi.spyOn(useToastStore.getState(), 'showToast');
    useChatStore.setState({ items: [{ kind: 'user_message', id: 'u-1', text: 'hi' }] });

    await useChatStore.getState().persistCurrentChat();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'), 'error');
  });
});
