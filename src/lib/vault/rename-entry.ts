import { requestRenameConfirmation } from '@/lib/vault/confirm-rename';
import { vaultService } from '@/services/vault.service';
import { useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

const PATH_SEPARATOR = /[/\\]/;

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function noteStem(path: string): string {
  const name = path.split(/[/\\]/).pop() ?? path;
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function reloadRewrittenBuffers(paths: string[]): Promise<void> {
  const dirtyTitles: string[] = [];

  for (const path of paths) {
    const buffer = useEditorStore.getState().buffers.find((candidate) => candidate.source === 'vault' && candidate.filePath === path);
    if (buffer === undefined) continue;
    if (buffer.dirty) {
      dirtyTitles.push(buffer.title);
      continue;
    }

    try {
      const content = await vaultService.readNote(path);
      const current = useEditorStore.getState().buffers.find((candidate) => candidate.id === buffer.id);
      if (current?.dirty) {
        dirtyTitles.push(current.title);
        continue;
      }
      useEditorStore.getState().reloadCleanBuffer(path, content);
    } catch (error) {
      useToastStore.getState().showToast(`Could not reload rewritten note: ${messageFor(error)}`, 'error');
    }
  }

  if (dirtyTitles.length > 0) useToastStore.getState().showToast(`Skipped dirty buffers: ${dirtyTitles.join(', ')}`, 'error');
}

/** Renames a vault entry, preserving open buffers and updating unambiguous note wikilinks. */
export async function renameVaultEntry(path: string, rawName: string, isDir: boolean): Promise<void> {
  const { beginRename, cancelRename, setCursor } = useSidebarStore.getState();
  const { showToast } = useToastStore.getState();
  const name = rawName.trim();
  if (name === '') {
    cancelRename();
    return;
  }
  if (PATH_SEPARATOR.test(name)) {
    showToast('Name cannot contain a path separator', 'error');
    return;
  }

  const oldStem = noteStem(path);
  const newStem = noteStem(name);
  if (name === (isDir ? noteStem(path) : oldStem) || (!isDir && newStem === oldStem)) {
    cancelRename();
    return;
  }

  let scan = null;
  if (!isDir) {
    try {
      scan = await vaultService.scanWikilinkTargets(oldStem);
    } catch (error) {
      showToast(`Rename failed: ${messageFor(error)}`, 'error');
      return;
    }

    if (scan.links > 0 && !scan.ambiguous) {
      const decision = await requestRenameConfirmation(oldStem, newStem, scan);
      if (decision === 'cancel') return;
    }
  }

  let newPath: string;
  try {
    newPath = await vaultService.renameEntry(path, name);
  } catch (error) {
    // A confirmation modal blurs and cancels the inline row; restore it so a collision can be corrected.
    beginRename(path);
    showToast(`Rename failed: ${messageFor(error)}`, 'error');
    return;
  }

  cancelRename();
  useEditorStore.getState().rewriteBufferPaths(path, newPath);
  setCursor(newPath);

  if (isDir || scan === null) return;
  if (scan.ambiguous) {
    showToast(`Renamed, but wikilinks were not updated because [[${oldStem}]] is ambiguous.`, 'error');
    return;
  }

  try {
    const rewrite = await vaultService.rewriteWikilinks(oldStem, newStem);
    if (rewrite.skippedAmbiguous) {
      showToast(`Renamed, but wikilinks were not updated because [[${oldStem}]] is ambiguous.`, 'error');
      return;
    }
    if (rewrite.linksChanged > 0) {
      showToast(`Updated ${countLabel(rewrite.linksChanged, 'link', 'links')} in ${countLabel(rewrite.notesChanged.length, 'note', 'notes')}`);
    }
    if (rewrite.failures.length > 0) {
      showToast(`Could not update wikilinks in ${countLabel(rewrite.failures.length, 'note', 'notes')}`, 'error');
    }
    await reloadRewrittenBuffers(rewrite.notesChanged);
  } catch (error) {
    showToast(`Renamed, but wikilinks could not be updated: ${messageFor(error)}`, 'error');
  }
}
