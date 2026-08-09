import type { FlatVaultRow } from '@/lib/vault/flatten-tree';
import { openVaultFile } from '@/lib/vault/open-file';
import { vaultService } from '@/services/vault.service';
import { type EntryDraft, useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

/**
 * A draft names an entry, it doesn't address one. `create_note`/`create_directory` refuse to
 * materialize a missing parent chain, so a separator could only ever mean "into some existing
 * subfolder" — which would contradict the parent the draft row is visibly indented under.
 */
const PATH_SEPARATOR = /[/\\]/;

/**
 * The directory a new entry belongs in, given where the cursor sits: a directory row takes the
 * entry as a child, any other row takes it as a sibling. Falls back to the vault root — which is
 * the only sensible target for an empty vault, where there is no cursor at all. `null` means no
 * vault is open, so nothing can be created.
 */
export function resolveDraftParent(rows: FlatVaultRow[], cursorPath: string | null, vaultRoot: string | null): string | null {
  if (vaultRoot === null) return null;

  const index = rows.findIndex((row) => row.entry.path === cursorPath);
  if (index === -1) return vaultRoot;

  const cursorRow = rows[index];
  if (cursorRow.entry.isDir) return cursorRow.entry.path;

  // Scanning back, the first shallower row is this row's parent directory — only directories have
  // children, so it can't be anything else.
  for (let i = index - 1; i >= 0; i--) {
    if (rows[i].depth < cursorRow.depth) return rows[i].entry.path;
  }
  return vaultRoot;
}

/** Parent for a context-menu create. `null` target is the empty background, which always means the
 * vault root — never the current cursor, which may sit anywhere. */
export function resolveParentForTarget(rows: FlatVaultRow[], target: string | null, vaultRoot: string | null): string | null {
  if (vaultRoot === null) return null;
  if (target === null) return vaultRoot;
  return resolveDraftParent(rows, target, vaultRoot);
}

/** Where the draft row renders: as its parent's first child, or at the top of the tree for the rootless vault root. */
export function draftPlacement(rows: FlatVaultRow[], draft: EntryDraft): { index: number; depth: number } {
  const parentIndex = rows.findIndex((row) => row.entry.path === draft.parentPath);
  if (parentIndex === -1) return { index: 0, depth: 0 };
  return { index: parentIndex + 1, depth: rows[parentIndex].depth + 1 };
}

/** Joins a name onto a vault directory path, keeping whichever separator the Rust side handed us. */
function joinVaultPath(parent: string, name: string): string {
  const separator = parent.includes('\\') ? '\\' : '/';
  return parent.endsWith(separator) ? `${parent}${name}` : `${parent}${separator}${name}`;
}

/**
 * Creates the drafted note or directory and reveals it — the mouse and keyboard affordances (#40)
 * both land here, the way both land in `openVaultFile` for opening. The tree is never touched:
 * the create trips the `notify` watcher, whose `vault-changed` drives `Sidebar`'s own refetch.
 */
export async function createVaultEntry(draft: EntryDraft, rawName: string): Promise<void> {
  const { cancelDraft, setCursor } = useSidebarStore.getState();
  const { showToast } = useToastStore.getState();

  const name = rawName.trim();
  if (name === '') {
    cancelDraft();
    return;
  }
  if (PATH_SEPARATOR.test(name)) {
    showToast('Name cannot contain a path separator', 'error');
    return;
  }

  const target = joinVaultPath(draft.parentPath, name);
  let path: string;
  try {
    path = draft.kind === 'note' ? await vaultService.createNote(target) : await vaultService.createDirectory(target);
  } catch (err: unknown) {
    // The draft stays up on failure — a name collision is the common case, and discarding what was
    // typed instead of letting it be corrected would be hostile.
    showToast(`Create failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    return;
  }

  cancelDraft();
  setCursor(path);
  if (draft.kind === 'note') {
    await openVaultFile(path).catch((err: unknown) => {
      showToast(`Open failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    });
  }
}
