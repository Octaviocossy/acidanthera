import { invoke } from '@tauri-apps/api/core';
import type { AgentModelId } from '@/lib/agent/model-catalog';

/** The app's color theme, applied by `useApplyTheme` (#28) via the `data-theme` attribute. */
export type ThemeName = 'dark' | 'light';

/** Persisted user settings. Mirrors the Rust `Settings` (`src-tauri/src/settings.rs`). */
export interface Settings {
  /** The agent model seeded into the chat at boot; its engine is derived from the catalog. */
  model: AgentModelId;
  /** Editor font family, applied by `useApplyTheme` (#28) via `--editor-font`. */
  editorFont: string;
  theme: ThemeName;
  /** Absolute path of the vault opened at boot. Defaults to `~/Documents/orbit-brain`. */
  vaultPath: string;
}

/** A single settings.toml degradation. Mirrors the Rust `SettingsDiagnostic`
 *  (`src-tauri/src/settings.rs`). `syntax` means the whole document was rejected (`settings`
 *  fell back to defaults); `field` means one key was missing or invalid and only that key did. */
export type SettingsDiagnostic = { kind: 'syntax'; message: string; line: number | null } | { kind: 'field'; key: string; message: string };

/** Return shape of `readSettings`. `settings` is always populated (never `null`); `diagnostics`
 *  is empty when the file parsed clean. Mirrors the Rust `SettingsReadResult`. */
export interface SettingsReadResult {
  settings: Settings;
  diagnostics: SettingsDiagnostic[];
}

/**
 * Typed wrapper over the Rust settings commands (`src-tauri/src/settings.rs`). The file lives
 * in the platform app-config dir as `settings.toml`; reads fall back to defaults (per key, or for
 * the whole document on a syntax error — see `SettingsDiagnostic`) when the file is missing,
 * unreadable, or invalid.
 */
export const settingsService = {
  /** Reads persisted settings (or defaults), with `vaultPath` always resolved. */
  readSettings: (): Promise<SettingsReadResult> => invoke('read_settings'),

  /** Persists the full settings object, editing only the changed keys of the existing TOML
   *  document in place so the user's comments and key order survive. */
  writeSettings: (settings: Settings): Promise<void> => invoke('write_settings', { settings }),
};
