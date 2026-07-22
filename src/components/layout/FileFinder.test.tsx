import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { FileFinder } from './FileFinder';

const { openVaultFile } = vi.hoisted(() => ({ openVaultFile: vi.fn() }));
vi.mock('@/lib/vault/open-file', () => ({ openVaultFile }));

afterEach(cleanup);

beforeEach(() => {
  openVaultFile.mockReset();
  useAppStore.setState({ vaultRoot: '/vault' });
  useSidebarStore.setState({
    tree: [{ name: 'notes', path: '/vault/notes', isDir: true, children: [{ name: 'ideas.md', path: '/vault/notes/ideas.md', isDir: false, children: null }] }],
  });
  useFileFinderStore.getState().hide();
});

describe('FileFinder', () => {
  it('renders an accessible combobox with recursively discovered notes', () => {
    useFileFinderStore.getState().show();
    render(<FileFinder />);

    expect(screen.getByRole('dialog', { name: 'Find file' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getByRole('option', { name: 'notes/ideas.md' })).toBeInTheDocument();
  });

  it('filters and opens the highlighted result with Enter', async () => {
    const user = userEvent.setup();
    openVaultFile.mockResolvedValue(undefined);
    useFileFinderStore.getState().show();
    render(<FileFinder />);

    await user.type(screen.getByRole('combobox'), 'idea');
    await user.keyboard('{Enter}');

    expect(openVaultFile).toHaveBeenCalledWith('/vault/notes/ideas.md');
    expect(useFileFinderStore.getState().open).toBe(false);
  });
});
