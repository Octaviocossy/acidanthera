import { requestDeleteConfirmation } from '@/lib/vault/confirm-delete';
import type { FlatVaultRow } from '@/lib/vault/flatten-tree';
import { type VaultEntry, vaultService } from '@/services/vault.service';
import type { EditorBuffer } from '@/stores/editor-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

export interface DeletionSummary {
  counts: {
    files: number;
    directories: number;
  };
  dirtyBuffers: string[];
}

function isPathAtOrUnder(path: string, target: string): boolean {
  const normalizedTarget = target.replace(/[\\/]+$/, '');
  return path === normalizedTarget || path.startsWith(`${normalizedTarget}/`) || path.startsWith(`${normalizedTarget}\\`);
}

function countEntries(entries: VaultEntry[], target: string): DeletionSummary['counts'] | null {
  for (const entry of entries) {
    if (entry.path === target) return countEntry(entry);
    if (entry.isDir && entry.children !== null) {
      const counts = countEntries(entry.children, target);
      if (counts !== null) return counts;
    }
  }
  return null;
}

function countEntry(entry: VaultEntry): DeletionSummary['counts'] {
  const counts = { files: entry.isDir ? 0 : 1, directories: entry.isDir ? 1 : 0 };
  for (const child of entry.children ?? []) {
    const childCounts = countEntry(child);
    counts.files += childCounts.files;
    counts.directories += childCounts.directories;
  }
  return counts;
}

/** Summarizes the cached vault subtree and open dirty vault buffers before a deletion is confirmed. */
export function summarizeDeletion(path: string, tree: VaultEntry[], buffers: EditorBuffer[]): DeletionSummary {
  return {
    counts: countEntries(tree, path) ?? { files: 0, directories: 0 },
    dirtyBuffers: buffers.filter((buffer) => buffer.source === 'vault' && buffer.dirty && isPathAtOrUnder(buffer.filePath, path)).map((buffer) => buffer.title),
  };
}

/** Selects the previous visible sibling, falling back to the parent directory or no cursor. */
export function nextCursorAfterDelete(rows: FlatVaultRow[], path: string): string | null {
  const index = rows.findIndex((row) => row.entry.path === path);
  if (index === -1) return null;

  for (let previous = index - 1; previous >= 0; previous--) {
    if (rows[previous].depth <= rows[index].depth) return rows[previous].entry.path;
  }
  return null;
}

/** Confirms and deletes one vault entry, closing every affected buffer only after the trash move succeeds. */
export async function deleteVaultEntry(path: string, rows: FlatVaultRow[]): Promise<void> {
  const sidebar = useSidebarStore.getState();
  const summary = summarizeDeletion(path, sidebar.tree, useEditorStore.getState().buffers);
  const nextCursor = nextCursorAfterDelete(rows, path);
  const decision = await requestDeleteConfirmation(path, summary);
  if (decision === 'cancel') return;

  try {
    await vaultService.deleteEntry(path);
  } catch (error) {
    useToastStore.getState().showToast(`Delete failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return;
  }

  useEditorStore.getState().closeBuffersUnder(path);
  useSidebarStore.getState().setCursor(nextCursor);
  useToastStore.getState().showToast('Moved to Trash');
}
