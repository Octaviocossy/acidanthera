import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useChatHistoryStore } from '@/stores/chat-history-store';
import { useChatStore } from '@/stores/chat-store';
import { AgentPanel } from './AgentPanel';

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
});
