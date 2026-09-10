import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { executeAppCommand } from './app-command';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const initialFileFinderState = useFileFinderStore.getState();
const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();

const note: VaultEntry = { name: 'top', path: '/vault/top.md', isDir: false, modified: null, children: null };

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  useFileFinderStore.setState(initialFileFinderState, true);
  useAppStore.setState(initialAppState, true);
  useSidebarStore.setState(initialSidebarState, true);
});

describe('executeAppCommand', () => {
  it('opens the file finder for global.find-file', () => {
    executeAppCommand('global.find-file');

    expect(useFileFinderStore.getState().open).toBe(true);
  });

  it('starts a note draft for global.new-note', () => {
    useAppStore.setState({ vaultRoot: '/vault', sidebarExpanded: false, activeRegion: 'viewer' });
    useSidebarStore.setState({ tree: [note] });

    executeAppCommand('global.new-note');

    expect(useSidebarStore.getState().draft).toEqual({ kind: 'note', parentPath: '/vault' });
    expect(useAppStore.getState().sidebarExpanded).toBe(true);
  });

  it('opens the daily note for global.daily-note, without starting a draft', async () => {
    useAppStore.setState({ vaultRoot: '/vault' });
    useSidebarStore.setState({ tree: [note] });
    vi.mocked(invoke).mockRejectedValue('an entry already exists at that path');

    executeAppCommand('global.daily-note');
    // `executeAppCommand` is synchronous and fires the open without awaiting it.
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('create_directory', { path: '/vault/daily' }));

    expect(useSidebarStore.getState().draft).toBeNull();
  });
});
