import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasModalOverlay } from '@/lib/keymap/modal-overlay';
import { CloseBufferDialog } from './CloseBufferDialog';

const savedBuffer = {
  id: 'one',
  filePath: '/vault/one.md',
  title: 'one.md',
  content: '',
  dirty: true,
  revision: 1,
  savedRevision: 0,
  vimMode: 'normal' as const,
  view: 'read' as const,
  source: 'vault' as const,
};
describe('CloseBufferDialog', () => {
  afterEach(cleanup);

  it('offers Save, Discard, and Cancel for a dirty saved buffer', () => {
    render(<CloseBufferDialog buffer={savedBuffer} onSave={vi.fn().mockResolvedValue(true)} onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing without a closing buffer', () => {
    render(<CloseBufferDialog buffer={null} onSave={vi.fn().mockResolvedValue(false)} onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the closing buffer on screen, inert, while it leaves', async () => {
    const props = { onSave: vi.fn().mockResolvedValue(true), onDiscard: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<CloseBufferDialog buffer={savedBuffer} {...props} />);

    rerender(<CloseBufferDialog buffer={null} {...props} />);

    const dialog = screen.getByRole('dialog', { name: 'Close one.md?' });
    expect(hasModalOverlay()).toBe(false);
    expect(dialog.closest('[role="presentation"]')).toHaveAttribute('inert');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('leaves showing Saving… after a successful save', async () => {
    const user = userEvent.setup();
    const props = { onSave: vi.fn().mockResolvedValue(true), onDiscard: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<CloseBufferDialog buffer={savedBuffer} {...props} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    rerender(<CloseBufferDialog buffer={null} {...props} />); // what `saveAndClose` does before resolving true

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('returns to Save when the save fails', async () => {
    const user = userEvent.setup();
    render(<CloseBufferDialog buffer={savedBuffer} onSave={vi.fn().mockResolvedValue(false)} onDiscard={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  });
});
