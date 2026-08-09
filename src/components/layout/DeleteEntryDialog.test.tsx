import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { requestDeleteConfirmation } from '@/lib/vault/confirm-delete';
import { DeleteEntryDialog } from './DeleteEntryDialog';

describe('DeleteEntryDialog', () => {
  afterEach(cleanup);

  it('discloses Trash contents and dirty buffers before confirming', async () => {
    const user = userEvent.setup();
    const decision = requestDeleteConfirmation('/vault/notes', { counts: { files: 2, directories: 1 }, dirtyBuffers: ['draft.md'] });
    render(<DeleteEntryDialog />);

    expect(screen.getByRole('dialog', { name: 'Move to Trash?' })).toHaveTextContent('/vault/notes will move to Trash, including 1 directory and 2 notes.');
    expect(screen.getByText('Unsaved changes will be discarded:')).toBeInTheDocument();
    expect(screen.getByText('draft.md')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move to Trash' }));

    await expect(decision).resolves.toBe('confirm');
  });

  it('cancels without confirming', async () => {
    const user = userEvent.setup();
    const decision = requestDeleteConfirmation('/vault/note.md', { counts: { files: 1, directories: 0 }, dirtyBuffers: [] });
    render(<DeleteEntryDialog />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await expect(decision).resolves.toBe('cancel');
  });
});
