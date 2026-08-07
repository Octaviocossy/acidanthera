import type { ConfigFileName } from '@/services/config.service';

/** One of the two allowlisted config files, surfaced as a sidebar/finder entry. */
export interface ConfigEntry {
  name: ConfigFileName;
  label: string;
}

/**
 * The two config files (`src-tauri/src/config.rs`'s allowlist), kept as a separate source from
 * the vault tree — never injected into `sidebar.tree` (ADR 0004: config lives outside the vault
 * but is surfaced inside vault-scoped UI).
 */
export const CONFIG_ENTRIES: readonly ConfigEntry[] = [
  { name: 'settings.toml', label: 'settings.toml' },
  { name: 'keymaps.toml', label: 'keymaps.toml' },
];
