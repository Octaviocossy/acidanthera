import { beforeEach, describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { startNoteDraft } from './start-draft';

function note(name: string, path: string): VaultEntry {
  return { name, path, isDir: false, modified: null, children: null };
}

function directory(name: string, path: string, children: VaultEntry[] | null = []): VaultEntry {
  return { name, path, isDir: true, modified: null, children };
}

const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();

beforeEach(() => {
  useAppStore.setState(initialAppState, true);
  useSidebarStore.setState(initialSidebarState, true);
  useAppStore.setState({ vaultRoot: '/vault', sidebarExpanded: true });
  useSidebarStore.setState({ tree: [note('top', '/vault/top.md'), directory('folder', '/vault/folder', [note('inner', '/vault/folder/inner.md')])] });
});

describe('startNoteDraft', () => {
  it('begins a draft at the vault root when the cursor is nowhere', () => {
    startNoteDraft('note');

    expect(useSidebarStore.getState().draft).toEqual({ kind: 'note', parentPath: '/vault' });
    expect(useAppStore.getState().activeRegion).toBe('sidebar');
  });

  it('resolves the parent from the cursor row', () => {
    useSidebarStore.setState({ cursorPath: '/vault/folder' });

    startNoteDraft('directory');

    expect(useSidebarStore.getState().draft).toEqual({ kind: 'directory', parentPath: '/vault/folder' });
  });

  it('expands a collapsed sidebar first, so the draft has somewhere to render', () => {
    useAppStore.setState({ sidebarExpanded: false, activeRegion: 'viewer' });

    startNoteDraft('note');

    expect(useAppStore.getState().sidebarExpanded).toBe(true);
    expect(useAppStore.getState().activeRegion).toBe('sidebar');
    expect(useSidebarStore.getState().draft).not.toBeNull();
  });

  it('does nothing without an open vault', () => {
    useAppStore.setState({ vaultRoot: null });

    startNoteDraft('note');

    expect(useSidebarStore.getState().draft).toBeNull();
  });
});
