import { invoke } from '@tauri-apps/api/core';
import type { AgentSource } from '@/lib/agent/agent-event';

/** The app's color theme, applied by `useApplyTheme` (#28) via the `data-theme` attribute. */
export type ThemeName = 'dark' | 'light';

/** Persisted user settings. Mirrors the Rust `Settings` (`src-tauri/src/settings.rs`). */
export interface Settings {
  /** The agent engine seeded into the chat at boot. */
  engine: AgentSource;
  /** Editor font family, applied by `useApplyTheme` (#28) via `--editor-font`. */
  editorFont: string;
  theme: ThemeName;
  /** Absolute path of the vault opened at boot. Defaults to `~/Documents/orbit-brain`. */
  vaultPath: string;
}

/**
 * Typed wrapper over the Rust settings commands (`src-tauri/src/settings.rs`). The file lives
 * in the platform app-config dir; reads fall back to defaults when it doesn't exist yet.
 */
export const settingsService = {
  /** Reads persisted settings (or defaults), with `vaultPath` always resolved. */
  readSettings: (): Promise<Settings> => invoke('read_settings'),

  /** Persists the full settings object as JSON. */
  writeSettings: (settings: Settings): Promise<void> => invoke('write_settings', { settings }),
};
