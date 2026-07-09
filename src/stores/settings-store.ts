import { create } from 'zustand';
import { type Settings, settingsService } from '@/services/settings.service';

interface SettingsState {
  /** Loaded settings, or `null` until the boot-time `loadSettings` resolves. */
  settings: Settings | null;

  /** Reads settings from disk once; later calls return the in-memory copy. */
  loadSettings: () => Promise<Settings>;
  /** Merges `patch` into the current settings and writes the result through to disk. */
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

/**
 * Settings slice (#25): the in-memory mirror of the persisted settings file. Consumers
 * (chat engine seed, vault bootstrap; theme/font in #28, the dialog in #29) read from here —
 * only this store talks to `settingsService`.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,

  loadSettings: async () => {
    const loaded = get().settings;
    if (loaded) return loaded;
    const settings = await settingsService.readSettings();
    set({ settings });
    return settings;
  },

  updateSettings: async (patch) => {
    const current = get().settings ?? (await get().loadSettings());
    const next = { ...current, ...patch };
    set({ settings: next });
    await settingsService.writeSettings(next);
  },
}));
