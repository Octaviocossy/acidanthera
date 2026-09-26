import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useChatHistoryStore } from '@/stores/chat-history-store';
import { useChatStore } from '@/stores/chat-store';
import { AgentPanel } from './AgentPanel';

vi.mock('@/services/chats.service', () => ({
  chatsService: {
    saveChat: vi.fn(),
    readChat: vi.fn(),
    listChats: vi.fn(() => Promise.resolve([])),
    deleteChat: vi.fn(),
  },
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const initialAppState = useAppStore.getState();
const initialChatState = useChatStore.getState();
const initialChatHistoryState = useChatHistoryStore.getState();

const card = () => screen.queryByRole('complementary', { name: 'AI agent', hidden: true });

describe('AgentPanel', () => {
  beforeAll(() => {
    // jsdom has no `Element.prototype.scrollTo`, which the transcript's auto-scroll effect calls.
    Element.prototype.scrollTo = (() => {}) as unknown as Element['scrollTo'];
  });

  afterAll(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollTo');
  });

  beforeEach(() => {
    useAppStore.setState(initialAppState, true);
    useChatStore.setState(initialChatState, true);
    useChatHistoryStore.setState(initialChatHistoryState, true);
    useAppStore.setState({ vaultRoot: '/vault' });
  });

  afterEach(cleanup);

  it('renders no card while the panel is closed', () => {
    render(<AgentPanel />);
    expect(card()).not.toBeInTheDocument();
  });

  it('renders an already-open panel at once, at the default card width', () => {
    useAppStore.setState({ agentOpen: true });
    render(<AgentPanel />);
    const aside = card() as HTMLElement;
    expect(aside).toHaveStyle({ width: '340px' });
    expect(aside.closest('[inert]')).toBeNull();
  });

  it('takes typing in its composer from the first frame of its entrance', async () => {
    render(<AgentPanel />);
    act(() => useAppStore.getState().openAgent());
    expect(card()?.closest('[inert]')).toBeNull();
    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Chat input' }), 'hello');
    expect(screen.getByRole('textbox', { name: 'Chat input' })).toHaveValue('hello');
  });

  it('goes inert in the same act that closes it, then unmounts', async () => {
    useAppStore.setState({ agentOpen: true, activeRegion: 'agent' });
    render(<AgentPanel />);
    act(() => useAppStore.getState().closeAgent());
    expect(card()?.closest('[inert]')).not.toBeNull();
    expect(useAppStore.getState().activeRegion).toBe('viewer');
    await waitFor(() => expect(card()).not.toBeInTheDocument());
  });

  describe('tab crossfade', () => {
    beforeEach(() => {
      useAppStore.setState({ agentOpen: true });
    });

    it('keeps the outgoing tab inert while the incoming one fades in', async () => {
      render(<AgentPanel />);

      act(() => useChatHistoryStore.getState().setTab('history'));

      expect(screen.getByRole('tabpanel', { name: 'History' })).toBeInTheDocument();
      expect(screen.getByRole('tabpanel', { name: 'Chat', hidden: true }).closest('[inert]')).not.toBeNull();
      await waitFor(() => expect(screen.queryByRole('tabpanel', { name: 'Chat', hidden: true })).not.toBeInTheDocument());
    });

    it('moves DOM focus out of the composer when the tab switches away', () => {
      render(<AgentPanel />);
      const input = screen.getByRole('textbox', { name: 'Chat input' });
      input.focus();
      expect(document.activeElement).toBe(input);

      act(() => useChatHistoryStore.getState().setTab('history'));

      expect(document.activeElement).not.toBe(input);
    });
  });
});
