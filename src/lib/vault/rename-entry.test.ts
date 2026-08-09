import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenameEntryDialog } from '@/components/layout/RenameEntryDialog';
import { useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';
import { renameVaultEntry } from './rename-entry';

const { invoke, listen } = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen }));

const initialEditorState = useEditorStore.getState();
const initialSidebarState = useSidebarStore.getState();

function setRenameTarget(path = '/vault/Old.md') {
  useSidebarStore.setState({ renamePath: path });
}

describe('renameVaultEntry', () => {
  beforeEach(() => {
    invoke.mockReset();
    listen.mockReset();
    useEditorStore.setState(initialEditorState, true);
    useSidebarStore.setState(initialSidebarState, true);
    useToastStore.setState({ toasts: [] });
  });

  afterEach(cleanup);

  it('renames a zero-link note without opening a confirmation dialog', async () => {
    invoke.mockImplementation((command: string) => {
      if (command === 'scan_wikilink_targets') return Promise.resolve({ notes: [], links: 0, ambiguous: false });
      if (command === 'rename_entry') return Promise.resolve('/vault/New.md');
      if (command === 'rewrite_wikilinks') return Promise.resolve({ notesChanged: [], linksChanged: 0, failures: [], skippedAmbiguous: false });
      return Promise.resolve();
    });
    setRenameTarget();
    render(createElement(RenameEntryDialog));

    await renameVaultEntry('/vault/Old.md', 'New', false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('rename_entry', { path: '/vault/Old.md', newName: 'New' });
    expect(useSidebarStore.getState().renamePath).toBeNull();
  });

  it('renames a directory without scanning or opening a confirmation dialog', async () => {
    invoke.mockResolvedValue('/vault/archive');
    setRenameTarget('/vault/notes');
    render(createElement(RenameEntryDialog));

    await renameVaultEntry('/vault/notes', 'archive', true);

    expect(invoke).toHaveBeenCalledWith('rename_entry', { path: '/vault/notes', newName: 'archive' });
    expect(invoke).not.toHaveBeenCalledWith('scan_wikilink_targets', expect.anything());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aborts a linked note rename when link updates are cancelled', async () => {
    const user = userEvent.setup();
    invoke.mockImplementation((command: string) => {
      if (command === 'scan_wikilink_targets') return Promise.resolve({ notes: ['/vault/linked.md'], links: 1, ambiguous: false });
      return Promise.resolve();
    });
    setRenameTarget();
    render(createElement(RenameEntryDialog));

    const rename = renameVaultEntry('/vault/Old.md', 'New', false);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Update wikilinks?' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    await rename;

    expect(invoke).not.toHaveBeenCalledWith('rename_entry', expect.anything());
    expect(useSidebarStore.getState().renamePath).toBe('/vault/Old.md');
  });

  it('does not rewrite links when the filesystem rename fails', async () => {
    const user = userEvent.setup();
    invoke.mockImplementation((command: string) => {
      if (command === 'scan_wikilink_targets') return Promise.resolve({ notes: ['/vault/linked.md'], links: 1, ambiguous: false });
      if (command === 'rename_entry') return Promise.reject(new Error('already exists'));
      return Promise.resolve();
    });
    setRenameTarget();
    render(createElement(RenameEntryDialog));

    const rename = renameVaultEntry('/vault/Old.md', 'New', false);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Update wikilinks?' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Update links/ }));
    await rename;

    expect(invoke).not.toHaveBeenCalledWith('rewrite_wikilinks', expect.anything());
    expect(useSidebarStore.getState().renamePath).toBe('/vault/Old.md');
  });

  it('renames an ambiguous note but warns without rewriting links', async () => {
    invoke.mockImplementation((command: string) => {
      if (command === 'scan_wikilink_targets') return Promise.resolve({ notes: ['/vault/linked.md'], links: 1, ambiguous: true });
      if (command === 'rename_entry') return Promise.resolve('/vault/New.md');
      return Promise.resolve();
    });
    setRenameTarget();

    await renameVaultEntry('/vault/Old.md', 'New', false);

    expect(invoke).toHaveBeenCalledWith('rename_entry', { path: '/vault/Old.md', newName: 'New' });
    expect(invoke).not.toHaveBeenCalledWith('rewrite_wikilinks', expect.anything());
    expect(useToastStore.getState().toasts).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('ambiguous') })]));
  });
});
