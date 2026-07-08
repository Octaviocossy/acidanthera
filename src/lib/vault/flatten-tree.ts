import type { VaultEntry } from '@/services/vault.service';

export interface FlatVaultRow {
  entry: VaultEntry;
  depth: number;
}

/** Flattens the vault tree into its currently visible rows, skipping the children of collapsed directories. */
export function flattenVisibleTree(entries: VaultEntry[], expanded: Set<string>, depth = 0): FlatVaultRow[] {
  const rows: FlatVaultRow[] = [];
  for (const entry of entries) {
    rows.push({ entry, depth });
    if (entry.isDir && entry.children && expanded.has(entry.path)) {
      rows.push(...flattenVisibleTree(entry.children, expanded, depth + 1));
    }
  }
  return rows;
}
