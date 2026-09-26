import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { hasModalOverlay, topModalOverlay } from '@/lib/keymap/modal-overlay';
import { requestDeleteConfirmation } from '@/lib/vault/confirm-delete';
import { DeleteEntryDialog } from './DeleteEntryDialog';

describe('DeleteEntryDialog', () => {
  afterEach(cleanup);

  it('discloses Trash contents and dirty buffers before confirming', async () => {
    const user = userEvent.setup();
    const decision = requestDeleteConfirmation('/vault/notes', { counts: { files: 2, directories: 1 }, openBuffers: 1, dirtyBuffers: ['draft.md'] });
    render(<DeleteEntryDialog />);

    expect(screen.getByRole('dialog', { name: 'Move to Trash?' })).toHaveTextContent('1 directory and 2 notes move to Trash.');
    expect(screen.getByText('/vault/notes')).toBeInTheDocument();
    expect(screen.getByText('Any open buffers in this entry will close.')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes will be discarded:')).toBeInTheDocument();
    expect(screen.getByText('draft.md')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Move to Trash/ }));

    await expect(decision).resolves.toBe('confirm');
  });

  it('hides the buffers warning when none will close and cancels without confirming', async () => {
    const user = userEvent.setup();
    const decision = requestDeleteConfirmation('/vault/note.md', { counts: { files: 1, directories: 0 }, openBuffers: 0, dirtyBuffers: [] });
    render(<DeleteEntryDialog />);

    expect(screen.queryByText('Any open buffers in this entry will close.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cancel/ }));

    await expect(decision).resolves.toBe('cancel');
  });

  it('collapses a home prefix in the displayed path', async () => {
    const user = userEvent.setup();
    const decision = requestDeleteConfirmation('/Users/someone/brain/note.md', { counts: { files: 1, directories: 0 }, openBuffers: 0, dirtyBuffers: [] });
    render(<DeleteEntryDialog />);

    expect(screen.getByText('~/brain/note.md')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    await expect(decision).resolves.toBe('cancel');
  });

  it('holds the target on screen and releases the modal layer the moment it is answered', async () => {
    const decision = requestDeleteConfirmation('/vault/notes', { counts: { files: 2, directories: 1 }, openBuffers: 1, dirtyBuffers: ['draft.md'] });
    render(<DeleteEntryDialog />);
    expect(hasModalOverlay()).toBe(true);

    act(() => topModalOverlay()?.onConfirm?.()); // the Enter path, through the overlay

    expect(topModalOverlay()).toBeNull(); // a second Enter now reaches nothing
    expect(screen.getByText('/vault/notes')).toBeInTheDocument();
    expect(screen.getByText('draft.md')).toBeInTheDocument();
    await expect(decision).resolves.toBe('confirm');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
