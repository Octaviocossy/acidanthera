import { invoke } from '@tauri-apps/api/core';

/** File names accepted by the Rust config-file commands (`src-tauri/src/config.rs`). Any other
 *  name is rejected by the backend's allowlist. */
export type ConfigFileName = 'settings.toml' | 'keymaps.toml';

/** A syntax-error diagnostic surfaced when a config file fails to parse as TOML. `line` is the
 *  1-based line the parser attributed the error to, or `null` when it could not. */
export interface ConfigParseDiagnostic {
  message: string;
  line: number | null;
}

/** The result of parsing a config file: either its value or a syntax diagnostic. Mirrors the
 *  Rust `ConfigParseResult` (`src-tauri/src/config.rs`). */
export type ConfigParseResult = { kind: 'parsed'; value: unknown } | { kind: 'invalid'; diagnostic: ConfigParseDiagnostic };

/**
 * Typed wrapper over the Rust config-file commands (`src-tauri/src/config.rs`), mirroring
 * `settings.service.ts`. Both files live in the platform app-config dir, scoped by an explicit
 * two-name allowlist enforced on the Rust side — this service never widens that contract.
 */
export const configService = {
  /** Reads a config file's raw text. */
  readConfigFile: (name: ConfigFileName): Promise<string> => invoke('read_config_file', { name }),

  /** Persists a config file's raw text via an atomic temp-file-plus-rename write. */
  writeConfigFile: (name: ConfigFileName, contents: string): Promise<void> => invoke('write_config_file', { name, contents }),

  /** Parses a config file as TOML, returning either its value or a line-numbered syntax diagnostic. */
  parseConfigFile: (name: ConfigFileName): Promise<ConfigParseResult> => invoke('parse_config_file', { name }),
};
