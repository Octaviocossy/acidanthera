import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';
import { saveBuffer } from './save-buffer';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('saveBuffer', () => {
  it('writes a vault buffer through the vault note command', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await saveBuffer({ id: 1, bufferId: 'buffer-1', filePath: '/vault/note.md', content: '# Snapshot', revision: 3, source: 'vault' });

    expect(invoke).toHaveBeenCalledWith('write_note', { path: '/vault/note.md', contents: '# Snapshot' });
  });

  it('writes a config buffer through the config file command', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await saveBuffer({ id: 2, bufferId: 'buffer-2', filePath: 'settings.toml', content: 'theme = "dark"', revision: 1, source: 'config' });

    expect(invoke).toHaveBeenCalledWith('write_config_file', { name: 'settings.toml', contents: 'theme = "dark"' });
  });
});
