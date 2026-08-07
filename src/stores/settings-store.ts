import { create } from 'zustand';
import { type Settings, type SettingsDiagnostic, type SettingsReadResult, settingsService } from '@/services/settings.service';

/** Outcome of {@link SettingsState.applyReloadedSettings}, reported to `useConfigWatcher` so it
 *  knows whether to toast and live-apply, or to do nothing further:
 *  - `'echo'` — the reload matched this store's own last write; state is untouched.
 *  - `'syntax-error'` — the file is broken; only `diagnostics` updates, `settings` keeps the
 *    last-good value (spec decision 10).
 *  - `'applied'` — a genuine external change; both `settings` and `diagnostics` updated. */
export type ReloadOutcome = 'echo' | 'syntax-error' | 'applied';

function serialize(settings: Settings): string {
  return JSON.stringify(settings);
}

interface SettingsState {
  /** Loaded settings, or `null` until the boot-time `loadSettings` resolves. Always populated
   *  (falling back to defaults) once loaded, even when `settings.toml` has a syntax error. */
  settings: Settings | null;
  /** Diagnostics from the last load. A `'syntax'` entry means the file is broken and
   *  {@link updateSettings} refuses to write until it's fixed (spec decision 10). */
  diagnostics: SettingsDiagnostic[];
  /** Serialized snapshot of the settings object this store itself last wrote to disk via
   *  {@link updateSettings}. `applyReloadedSettings` compares a reload against this to recognize
   *  the config-dir watcher reporting the app's *own* write (Known Risk #2 — one `fs::write`
   *  loops back through `config-changed`) rather than a genuine external edit, so a dialog save
   *  doesn't re-render the dialog a second time. */
  lastWrittenSnapshot: string | null;

  /** Reads settings from disk once; later calls return the in-memory copy. */
  loadSettings: () => Promise<Settings>;
  /** Merges `patch` into the current settings and writes the result through to disk. Throws
   *  without writing if the file currently has a syntax error. */
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** Applies a settings reload triggered by the config-dir watcher (`useConfigWatcher`, #98). */
  applyReloadedSettings: (result: SettingsReadResult) => ReloadOutcome;
}

/**
 * Settings slice (#25; TOML + diagnostics in #96; live reload in #98): the in-memory mirror of
 * the persisted settings file. Consumers (chat engine seed, vault bootstrap; theme/font in #28,
 * the dialog in #29, the config watcher in #98) read from here — only this store talks to
 * `settingsService`.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  diagnostics: [],
  lastWrittenSnapshot: null,

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
    set({ settings: next, lastWrittenSnapshot: serialize(next) });
    await settingsService.writeSettings(next);
  },

  applyReloadedSettings: (result) => {
    const isEcho = get().lastWrittenSnapshot === serialize(result.settings);
    set({ lastWrittenSnapshot: null });
    if (isEcho) return 'echo';

    if (result.diagnostics.some((diagnostic) => diagnostic.kind === 'syntax')) {
      set({ diagnostics: result.diagnostics });
      return 'syntax-error';
    }

    set({ settings: result.settings, diagnostics: result.diagnostics });
    return 'applied';
  },
}));
