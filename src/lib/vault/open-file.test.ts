import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { openVaultFile } from './open-file';

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
  useAppStore.setState({ activeRegion: 'sidebar' });
});

describe('openVaultFile', () => {
  it('activates an existing buffer without reading and overwriting it', async () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/note.md', '# Disk');
    const bufferId = useEditorStore.getState().activeBufferId;
    if (bufferId === null) throw new Error('expected an active buffer');
    store.updateBufferContent(bufferId, '# Unsaved');
    await openVaultFile('/vault/note.md');

    expect(invoke).not.toHaveBeenCalled();
    expect(useEditorStore.getState().activeBufferId).toBe(bufferId);
    expect(useEditorStore.getState().buffers.find((buffer) => buffer.id === bufferId)).toMatchObject({ content: '# Unsaved', dirty: true });
    expect(useAppStore.getState().activeRegion).toBe('viewer');
  });

  it('reads and opens a file not already buffered', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('# Disk');

    await openVaultFile('/vault/note.md');

    expect(invoke).toHaveBeenCalledWith('read_note', { path: '/vault/note.md' });
    expect(useEditorStore.getState().buffers).toContainEqual(expect.objectContaining({ filePath: '/vault/note.md', content: '# Disk' }));
  });
});
