import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useReducedMotion } from 'motion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatFile } from '@/lib/chat/chat-file';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { ChatTranscript, isNearBottom } from './ChatTranscript';

vi.mock('@/services/chats.service', () => ({
  chatsService: {
    saveChat: vi.fn(),
    readChat: vi.fn(),
    listChats: vi.fn(),
    deleteChat: vi.fn(),
  },
}));

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: vi.fn(() => false),
}));

const initialAppState = useAppStore.getState();
const initialChatState = useChatStore.getState();

function chatPanel(): HTMLElement {
  return screen.getByRole('tabpanel', { name: 'Chat' });
}

function stubGeometry(list: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => clientHeight });
}

/** The `TranscriptItem` motion wrapper for the row carrying `text`: its content nests a variable
 *  number of `.flex` divs (an agent message adds one `ChatMessage` doesn't use for a user message),
 *  so the reliable anchor is the ancestor sitting directly under `.py-2` instead of a fixed depth. */
function transcriptItemOf(text: string): HTMLElement {
  let element: HTMLElement | null = screen.getByText(text);
  while (element?.parentElement && !element.parentElement.classList.contains('py-2')) {
    element = element.parentElement;
  }
  return element as HTMLElement;
}

beforeEach(() => {
  useAppStore.setState(initialAppState, true);
  useChatStore.setState(initialChatState, true);
  useAppStore.setState({ vaultRoot: '/vault' });
  useChatStore.setState({ items: [{ kind: 'user_message', id: 'u-1', text: 'hi' }], turnActive: false, transcriptGeneration: 0 });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(initialAppState, true);
  useChatStore.setState(initialChatState, true);
  vi.mocked(useReducedMotion).mockReturnValue(false);
});

describe('isNearBottom', () => {
  it('treats 64px from the bottom as near and 65px as not', () => {
    expect(isNearBottom({ scrollHeight: 1000, clientHeight: 200 }, 736)).toBe(true);
    expect(isNearBottom({ scrollHeight: 1000, clientHeight: 200 }, 735)).toBe(false);
  });
});

describe('ChatTranscript', () => {
  it('fades a new item in while the items already there hold still', () => {
    render(<ChatTranscript />);

    act(() => {
      useChatStore.setState((state) => ({ items: [...state.items, { kind: 'agent_message', id: 'a-1', text: 'hello there' }] }));
    });

    expect(transcriptItemOf('hello there')).toHaveStyle({ opacity: '0' });
    expect(transcriptItemOf('hi')).not.toHaveStyle({ opacity: '0' });
  });

  it('remounts without animating when a saved chat is loaded', () => {
    render(<ChatTranscript />);
    const file: ChatFile = {
      meta: { schema: 1, id: 'chat-9', title: 'Saved thread', model: 'sonnet-5', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z' },
      items: [
        { kind: 'user_message', id: 'u-10', text: 'loaded one' },
        { kind: 'agent_message', id: 'a-10', text: 'loaded two' },
      ],
    };

    act(() => useChatStore.getState().loadChat(file));

    expect(screen.queryByText('hi')).toBeNull();
    expect(transcriptItemOf('loaded one')).not.toHaveStyle({ opacity: '0' });
    expect(transcriptItemOf('loaded two')).not.toHaveStyle({ opacity: '0' });
  });

  it('clears at once on a new chat', () => {
    render(<ChatTranscript />);

    act(() => useChatStore.getState().newChat());

    expect(screen.queryByText('hi')).toBeNull();
  });

  it('follows new content smoothly when the reader sat near the bottom', async () => {
    render(<ChatTranscript />);
    const list = chatPanel();
    stubGeometry(list, 1000, 200);
    list.scrollTop = 800;
    fireEvent.scroll(list);

    stubGeometry(list, 1400, 200);
    act(() => {
      useChatStore.setState((state) => ({ items: [...state.items, { kind: 'agent_message', id: 'a-2', text: 'more' }] }));
    });

    await waitFor(() => expect(list.scrollTop).toBe(1200));
  });

  it('leaves the reader where they are once they have scrolled up', async () => {
    render(<ChatTranscript />);
    const list = chatPanel();
    stubGeometry(list, 1000, 200);
    list.scrollTop = 100;
    fireEvent.scroll(list);

    stubGeometry(list, 1400, 200);
    act(() => {
      useChatStore.setState((state) => ({ items: [...state.items, { kind: 'agent_message', id: 'a-3', text: 'more again' }] }));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(list.scrollTop).toBe(100);
  });

  it('jumps straight to the bottom under Reduce Motion', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<ChatTranscript />);
    const list = chatPanel();
    stubGeometry(list, 1000, 200);
    list.scrollTop = 800;
    fireEvent.scroll(list);

    stubGeometry(list, 1400, 200);
    act(() => {
      useChatStore.setState((state) => ({ items: [...state.items, { kind: 'agent_message', id: 'a-4', text: 'final' }] }));
    });

    expect(list.scrollTop).toBe(1200);
  });

  it('pins a freshly mounted transcript to its bottom', () => {
    const scrollHeightSpy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);

    render(<ChatTranscript />);

    expect(chatPanel().scrollTop).toBe(800);

    scrollHeightSpy.mockRestore();
    clientHeightSpy.mockRestore();
  });
});
