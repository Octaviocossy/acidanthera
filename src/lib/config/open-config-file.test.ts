import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { openConfigFile } from './open-config-file';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

function resetEditor() {
  useEditorStore.setState({
    buffers: [],
    activeBufferId: null,
    saveRequests: [],
  });
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  resetEditor();
  useAppStore.setState({ activeRegion: 'sidebar', editorFocusRequest: 0 });
});

describe('openConfigFile', () => {
  it('activates an existing config buffer without reading and overwriting it', async () => {
    const store = useEditorStore.getState();
    store.openFile('settings.toml', 'theme = "dark"', 'config');
    const bufferId = useEditorStore.getState().activeBufferId;
    if (bufferId === null) throw new Error('expected an active buffer');
    store.updateBufferContent(bufferId, 'theme = "light"');
    await openConfigFile('settings.toml');

    expect(invoke).not.toHaveBeenCalled();
    expect(useEditorStore.getState().activeBufferId).toBe(bufferId);
    expect(useEditorStore.getState().buffers.find((buffer) => buffer.id === bufferId)).toMatchObject({ content: 'theme = "light"', dirty: true });
    expect(useAppStore.getState().activeRegion).toBe('viewer');
    expect(useAppStore.getState().editorFocusRequest).toBe(1);
  });

  it('reads and opens a config file not already buffered, tagged with the config source', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('theme = "dark"');

    await openConfigFile('settings.toml');

    expect(invoke).toHaveBeenCalledWith('read_config_file', { name: 'settings.toml' });
    expect(useEditorStore.getState().buffers).toContainEqual(expect.objectContaining({ filePath: 'settings.toml', content: 'theme = "dark"', source: 'config' }));
    expect(useAppStore.getState().activeRegion).toBe('viewer');
    expect(useAppStore.getState().editorFocusRequest).toBe(1);
  });

  it("does not activate a vault buffer that happens to share the config file's name", async () => {
    const store = useEditorStore.getState();
    store.openFile('settings.toml', '# a note literally named settings.toml');
    vi.mocked(invoke).mockResolvedValueOnce('theme = "dark"');

    await openConfigFile('settings.toml');

    expect(invoke).toHaveBeenCalledWith('read_config_file', { name: 'settings.toml' });
    expect(useEditorStore.getState().buffers).toHaveLength(2);
  });
});
