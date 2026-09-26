import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatRecord } from '@/services/chats.service';
import { useChatHistoryStore } from '@/stores/chat-history-store';
import { ChatHistoryList } from './ChatHistoryList';

const { listChats } = vi.hoisted(() => ({ listChats: vi.fn() }));

vi.mock('@/services/chats.service', () => ({
  chatsService: { saveChat: vi.fn(), readChat: vi.fn(), listChats, deleteChat: vi.fn() },
}));

const RECORDS: ChatRecord[] = [
  { id: 'chat-1', path: '/vault/.acidanthera/chats/chat-1.chat.md', updatedMs: Date.now(), contents: '' },
  { id: 'chat-2', path: '/vault/.acidanthera/chats/chat-2.chat.md', updatedMs: Date.now(), contents: '' },
];

const initialChatHistoryState = useChatHistoryStore.getState();

afterEach(() => {
  cleanup();
  useChatHistoryStore.setState(initialChatHistoryState, true);
});

describe('ChatHistoryList', () => {
  it('never transitions the keyboard cursor, only the pointer-hover layer', async () => {
    listChats.mockResolvedValue(RECORDS);
    useChatHistoryStore.setState({ cursorId: 'chat-1' });
    render(<ChatHistoryList />);
    const options = await screen.findAllByRole('option');

    const cursorRow = options.find((option) => option.dataset.cursor === 'true') as HTMLElement;
    const otherRow = options.find((option) => option.dataset.cursor !== 'true') as HTMLElement;

    expect(cursorRow).toHaveClass('bg-elevated', 'before:hidden');
    expect(cursorRow.className).not.toMatch(/(^|\s)transition/);
    expect(otherRow).toHaveClass('before:transition-opacity', 'before:duration-[var(--dur-fast)]', 'hover:before:opacity-100');
    expect(otherRow).not.toHaveClass('before:hidden');
  });

  it('hovers on the background layer instead of lifting the text', async () => {
    listChats.mockResolvedValue(RECORDS);
    useChatHistoryStore.setState({ cursorId: 'chat-1' });
    render(<ChatHistoryList />);
    const options = await screen.findAllByRole('option');

    for (const option of options) {
      expect(option).not.toHaveClass('hover:text-text-primary');
    }
  });
});
