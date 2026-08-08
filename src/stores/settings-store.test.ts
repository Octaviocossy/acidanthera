import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings, SettingsReadResult } from '@/services/settings.service';
import { useSettingsStore } from './settings-store';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const BASE_SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault' };
const initialState = useSettingsStore.getState();

beforeEach(() => {
  useSettingsStore.setState(initialState, true);
  vi.mocked(invoke).mockReset();
});

describe('applyReloadedSettings', () => {
  it('treats a reload matching its own last write as an echo and leaves state untouched', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined); // write_settings
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });
    await useSettingsStore.getState().updateSettings({ theme: 'light' });
    const settingsAfterUpdate = useSettingsStore.getState().settings;

    const outcome = useSettingsStore.getState().applyReloadedSettings({ settings: { ...BASE_SETTINGS, theme: 'light' }, diagnostics: [] });

    expect(outcome).toBe('echo');
    expect(useSettingsStore.getState().settings).toBe(settingsAfterUpdate);
  });

  it('applies a genuine external change that does not match the last write', () => {
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [], lastWrittenSnapshot: null });
    const reloaded: SettingsReadResult = { settings: { ...BASE_SETTINGS, theme: 'light' }, diagnostics: [] };

    const outcome = useSettingsStore.getState().applyReloadedSettings(reloaded);

    expect(outcome).toBe('applied');
    expect(useSettingsStore.getState().settings).toEqual(reloaded.settings);
  });

  it('keeps the last-good settings on a syntax error, updating only diagnostics', () => {
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [], lastWrittenSnapshot: null });
    const reloaded: SettingsReadResult = {
      settings: { model: 'gpt-5.4-mini', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault' },
      diagnostics: [{ kind: 'syntax', message: 'unexpected token', line: 4 }],
    };

    const outcome = useSettingsStore.getState().applyReloadedSettings(reloaded);

    expect(outcome).toBe('syntax-error');
    expect(useSettingsStore.getState().settings).toEqual(BASE_SETTINGS);
    expect(useSettingsStore.getState().diagnostics).toEqual(reloaded.diagnostics);
  });
});
