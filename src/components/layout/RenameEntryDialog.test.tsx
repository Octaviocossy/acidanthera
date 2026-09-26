import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { hasModalOverlay, topModalOverlay } from '@/lib/keymap/modal-overlay';
import { requestRenameConfirmation } from '@/lib/vault/confirm-rename';
import { useAppStore } from '@/stores/app-store';
import { RenameEntryDialog } from './RenameEntryDialog';

const initialAppState = useAppStore.getState();
const SCAN = { notes: ['/vault/a.md', '/vault/sub/b.md'], links: 3, ambiguous: false };

describe('RenameEntryDialog', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState(initialAppState, true);
  });

  it('lists every affected note relative to the vault', async () => {
    useAppStore.setState({ vaultRoot: '/vault' });
    const decision = requestRenameConfirmation('Old', 'New', SCAN);
    render(<RenameEntryDialog />);

    expect(screen.getByRole('dialog', { name: 'Update wikilinks?' })).toHaveTextContent('[[Old]]');
    expect(screen.getByText('sub/b.md')).toBeInTheDocument();
    act(() => topModalOverlay()?.onCancel());
    await expect(decision).resolves.toBe('cancel');
  });

  it('holds the stems on screen and releases the modal layer the moment it is answered', async () => {
    const decision = requestRenameConfirmation('Old', 'New', SCAN);
    render(<RenameEntryDialog />);

    act(() => topModalOverlay()?.onCancel());

    expect(hasModalOverlay()).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Update wikilinks?' })).toHaveTextContent('[[Old]]');
    await expect(decision).resolves.toBe('cancel');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
