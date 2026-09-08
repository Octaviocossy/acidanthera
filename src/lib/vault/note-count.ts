import type { VaultEntry } from '@/services/vault.service';

/**
 * Counts every note beneath `entries`, at any depth. It is a property of the vault, not of the
 * view, so it ignores expansion state entirely — a folder's trailing number and the footer's
 * `N notes` are one measure at two scopes.
 *
 * Deliberately not `children.length`: a folder holding two note-filled subfolders would read `2`,
 * which is a different meaning of "count" in the same panel.
 */
export function countNotes(entries: VaultEntry[]): number {
  let total = 0;
  for (const entry of entries) {
    if (!entry.isDir) total += 1;
    total += countNotes(entry.children ?? []);
  }
  return total;
}
