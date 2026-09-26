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

/**
 * The directory a cached tree was read from, i.e. its *root entries*' parent, or `null` for an
 * empty tree. A render key only: `Sidebar` keys its row list on it, so a tree from another vault
 * remounts the list instead of animating a wholesale replacement. `vaultRoot` alone cannot do this,
 * because the old vault's tree stays cached until the new one is read.
 */
export function treeVaultRoot(entries: readonly VaultEntry[]): string | null {
  const first = entries[0];
  if (first === undefined) return null;
  return first.path.slice(0, Math.max(0, Math.max(first.path.lastIndexOf('/'), first.path.lastIndexOf('\\'))));
}
