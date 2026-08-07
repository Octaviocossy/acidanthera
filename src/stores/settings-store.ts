import { create } from 'zustand';
import { type Settings, type SettingsDiagnostic, settingsService } from '@/services/settings.service';

interface SettingsState {
  /** Loaded settings, or `null` until the boot-time `loadSettings` resolves. Always populated
   *  (falling back to defaults) once loaded, even when `settings.toml` has a syntax error. */
  settings: Settings | null;
  /** Diagnostics from the last load. A `'syntax'` entry means the file is broken and
   *  {@link updateSettings} refuses to write until it's fixed (spec decision 10). */
  diagnostics: SettingsDiagnostic[];

  /** Reads settings from disk once; later calls return the in-memory copy. */
  loadSettings: () => Promise<Settings>;
  /** Merges `patch` into the current settings and writes the result through to disk. Throws
   *  without writing if the file currently has a syntax error. */
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

/**
 * Settings slice (#25; TOML + diagnostics in #96): the in-memory mirror of the persisted
 * settings file. Consumers (chat engine seed, vault bootstrap; theme/font in #28, the dialog in
 * #29) read from here — only this store talks to `settingsService`.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  diagnostics: [],

  loadSettings: async () => {
    const loaded = get().settings;
    if (loaded) return loaded;
    const { settings, diagnostics } = await settingsService.readSettings();
    set({ settings, diagnostics });
    return settings;
  },

  updateSettings: async (patch) => {
    if (get().diagnostics.some((diagnostic) => diagnostic.kind === 'syntax')) {
      throw new Error('settings.toml has a syntax error; fix it before changing settings');
    }
    const current = get().settings ?? (await get().loadSettings());
    const next = { ...current, ...patch };
    set({ settings: next });
    await settingsService.writeSettings(next);
  },
}));
