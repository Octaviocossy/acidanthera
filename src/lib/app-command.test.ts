import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@/services/settings.service';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { executeAppCommand } from './app-command';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const initialFileFinderState = useFileFinderStore.getState();
const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();
const initialSettingsState = useSettingsStore.getState();

const note: VaultEntry = { name: 'top', path: '/vault/top.md', isDir: false, modified: null, children: null };
const BASE_SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault', dailyNoteFolder: 'daily', contentZoom: 1 };

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  useFileFinderStore.setState(initialFileFinderState, true);
  useAppStore.setState(initialAppState, true);
  useSidebarStore.setState(initialSidebarState, true);
  useSettingsStore.setState(initialSettingsState, true);
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

  it('steps contentZoom up by 0.1 for global.zoom-in', async () => {
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });

    executeAppCommand('global.zoom-in');
    await vi.waitFor(() => expect(useSettingsStore.getState().settings?.contentZoom).toBe(1.1));
  });

  it('steps contentZoom down by 0.1 for global.zoom-out', async () => {
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });

    executeAppCommand('global.zoom-out');
    await vi.waitFor(() => expect(useSettingsStore.getState().settings?.contentZoom).toBe(0.9));
  });

  it('clamps global.zoom-in at the maximum', async () => {
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, contentZoom: 1.6 }, diagnostics: [] });

    executeAppCommand('global.zoom-in');
    await vi.waitFor(() => expect(useSettingsStore.getState().settings?.contentZoom).toBe(1.6));
  });

  it('clamps global.zoom-out at the minimum', async () => {
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, contentZoom: 0.8 }, diagnostics: [] });

    executeAppCommand('global.zoom-out');
    await vi.waitFor(() => expect(useSettingsStore.getState().settings?.contentZoom).toBe(0.8));
  });

  it('resets contentZoom to 1 for global.zoom-reset', async () => {
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, contentZoom: 1.4 }, diagnostics: [] });

    executeAppCommand('global.zoom-reset');
    await vi.waitFor(() => expect(useSettingsStore.getState().settings?.contentZoom).toBe(1));
  });
});
