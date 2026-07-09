import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** A file or directory in the open vault, filtered to `.md` notes (doc/v0-spec.md §3.1). Mirrors the Rust `VaultEntry` (`src-tauri/src/vault.rs`). */
export interface VaultEntry {
  name: string;
  path: string;
  isDir: boolean;
  children: VaultEntry[] | null;
}

/** Emitted by the Rust `notify` watcher whenever a file inside the open vault changes. */
const VAULT_CHANGED_EVENT = 'vault-changed';

/**
 * Typed wrapper over the vault filesystem commands (doc/v0-spec.md §3.2). All reads/writes are
 * vault-root-guarded on the Rust side — `path` values must come from `readVaultTree`.
 */
export const vaultService = {
  /** Opens a native folder picker and adopts the chosen folder as the vault root. */
  pickVault: (): Promise<string> => invoke('pick_vault'),

  /** Adopts `path` as the vault root without a picker, creating the directory if missing. */
  openVault: (path: string): Promise<string> => invoke('open_vault', { path }),

  /** Reads the open vault's file tree, filtered to `.md` notes and their parent directories. */
  readVaultTree: (): Promise<VaultEntry[]> => invoke('read_vault_tree'),

  /** Reads a note's contents. `path` must be one returned by `readVaultTree`. */
  readNote: (path: string): Promise<string> => invoke('read_note', { path }),

  /** Writes a note's contents. `path` must be one returned by `readVaultTree`. */
  writeNote: (path: string, contents: string): Promise<void> => invoke('write_note', { path, contents }),

  /** Subscribes to `vault-changed`, firing with the filesystem paths touched by the change. */
  onVaultChanged: (handler: (paths: string[]) => void): Promise<UnlistenFn> => listen<string[]>(VAULT_CHANGED_EVENT, (event) => handler(event.payload)),
};
