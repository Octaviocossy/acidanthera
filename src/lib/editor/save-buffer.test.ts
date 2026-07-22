import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';
import { saveBuffer } from './save-buffer';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('saveBuffer', () => {
  it('writes the content captured in the targeted save request', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await saveBuffer({ id: 1, bufferId: 'buffer-1', filePath: '/vault/note.md', content: '# Snapshot', revision: 3 });

    expect(invoke).toHaveBeenCalledWith('write_note', { path: '/vault/note.md', contents: '# Snapshot' });
  });
});
