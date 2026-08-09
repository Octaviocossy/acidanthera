import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** A file or directory in the open vault — every directory, but only `.md` files (doc/v0-spec.md §3.1). Mirrors the Rust `VaultEntry` (`src-tauri/src/vault.rs`). */
export interface VaultEntry {
  name: string;
  path: string;
  isDir: boolean;
  children: VaultEntry[] | null;
}

/** Matching wikilinks found across the open vault. */
export interface WikilinkScan {
  notes: string[];
  links: number;
  ambiguous: boolean;
}

/** Result of rewriting matching wikilink targets across the open vault. */
export interface WikilinkRewrite {
  notesChanged: string[];
  linksChanged: number;
  failures: string[];
  skippedAmbiguous: boolean;
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

  /** Reads the open vault's file tree: every directory (including empty ones) plus its `.md` notes. */
  readVaultTree: (): Promise<VaultEntry[]> => invoke('read_vault_tree'),

  /** Reads a note's contents. `path` must be one returned by `readVaultTree`. */
  readNote: (path: string): Promise<string> => invoke('read_note', { path }),

  /** Writes a note's contents. `path` must be one returned by `readVaultTree`. */
  writeNote: (path: string, contents: string): Promise<void> => invoke('write_note', { path, contents }),

  /** Creates an empty note (`.md` appended when missing) inside an existing vault directory, resolving to its path. Rejects if an entry already exists there. */
  createNote: (path: string): Promise<string> => invoke('create_note', { path }),

  /** Creates an empty directory inside an existing vault directory, resolving to its path. Rejects if an entry already exists there. */
  createDirectory: (path: string): Promise<string> => invoke('create_directory', { path }),

  /** Moves a note or directory to the OS trash. */
  deleteEntry: (path: string): Promise<void> => invoke('delete_entry', { path }),

  /** Renames a note or directory within its current parent. */
  renameEntry: (path: string, newName: string): Promise<string> => invoke('rename_entry', { path, newName }),

  /** Duplicates a note or directory within its current parent. */
  duplicateEntry: (path: string): Promise<string> => invoke('duplicate_entry', { path }),

  /** Finds links whose target matches `stem` and reports whether that stem is ambiguous. */
  scanWikilinkTargets: (stem: string): Promise<WikilinkScan> => invoke('scan_wikilink_targets', { stem }),

  /** Rewrites matching link targets unless more than one note owns `oldStem`. */
  rewriteWikilinks: (oldStem: string, newStem: string): Promise<WikilinkRewrite> => invoke('rewrite_wikilinks', { oldStem, newStem }),

  /** Subscribes to `vault-changed`, firing with the filesystem paths touched by the change. */
  onVaultChanged: (handler: (paths: string[]) => void): Promise<UnlistenFn> => listen<string[]>(VAULT_CHANGED_EVENT, (event) => handler(event.payload)),
};
