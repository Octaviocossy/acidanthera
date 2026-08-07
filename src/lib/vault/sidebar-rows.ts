import { CONFIG_ENTRIES, type ConfigEntry } from '@/lib/config/config-entries';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import type { VaultEntry } from '@/services/vault.service';

/** The Config section header's synthetic cursor/expansion path — never a real vault path (they're
 *  always absolute filesystem paths), so it can share `sidebar.expanded`/`cursorPath` safely. */
export const CONFIG_SECTION_PATH = '__config__';

export type SidebarRow =
  | { source: 'vault'; path: string; depth: number; entry: VaultEntry }
  | { source: 'config-section'; path: typeof CONFIG_SECTION_PATH; depth: 0 }
  | { source: 'config'; path: string; depth: 1; entry: ConfigEntry };

/**
 * Vault rows, then the pinned Config section — folded by default, expanding like a directory
 * (#100). A single concatenated list so cursor movement (`j`/`k`) and open dispatch (`l`/`Enter`,
 * click, finder select) walk both sources without re-deriving routing at each call site (ADR
 * 0004: config lives outside the vault but is surfaced inside vault-scoped UI). Config entries
 * are never written into `sidebar.tree` itself — it's overwritten wholesale on every
 * `vault-changed`, so anything injected there would be silently wiped.
 */
export function flattenSidebarRows(tree: VaultEntry[], expanded: Set<string>): SidebarRow[] {
  const vaultRows: SidebarRow[] = flattenVisibleTree(tree, expanded).map(({ entry, depth }) => ({ source: 'vault', path: entry.path, depth, entry }));

  const configRows: SidebarRow[] = [{ source: 'config-section', path: CONFIG_SECTION_PATH, depth: 0 }];
  if (expanded.has(CONFIG_SECTION_PATH)) {
    configRows.push(...CONFIG_ENTRIES.map((entry): SidebarRow => ({ source: 'config', path: entry.name, depth: 1, entry })));
  }

  return [...vaultRows, ...configRows];
}
