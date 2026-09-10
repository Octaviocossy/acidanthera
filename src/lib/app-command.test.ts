import { beforeEach, describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { executeAppCommand } from './app-command';

const initialFileFinderState = useFileFinderStore.getState();
const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();

const note: VaultEntry = { name: 'top', path: '/vault/top.md', isDir: false, modified: null, children: null };

beforeEach(() => {
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

  // #TBD-2 adds the case; declaring the id early is what lets other surfaces render its chord.
  it('does nothing yet for global.daily-note', () => {
    useAppStore.setState({ vaultRoot: '/vault' });
    useSidebarStore.setState({ tree: [note] });

    executeAppCommand('global.daily-note');

    expect(useSidebarStore.getState().draft).toBeNull();
  });
});
