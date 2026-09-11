import { vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { type BufferView, useEditorStore } from '@/stores/editor-store';

/** Opens a vault note into the editor and moves both region focus and real DOM focus into it
 *  (doc/v0-spec.md §5.3, §6) — `focusEditor` bumps a request nonce so re-opening the buffer that is
 *  already active still re-claims focus from whatever overlay just closed.
 *
 *  `view` is passed only by a caller that just *created* the note (spec decision 4); every other
 *  open takes the `'read'` default. It is deliberately ignored when the path is already open — the
 *  buffer keeps the view it had, exactly as it keeps its unsaved content (invariant 6). */
export async function openVaultFile(path: string, view?: BufferView): Promise<void> {
  const existing = useEditorStore.getState().buffers.find((buffer) => buffer.filePath === path);
  if (existing !== undefined) {
    useEditorStore.getState().activateBuffer(existing.id);
    useAppStore.getState().focusEditor();
    return;
  }

  const content = await vaultService.readNote(path);
  useEditorStore.getState().openFile(path, content, 'vault', view);
  useAppStore.getState().focusEditor();
}
