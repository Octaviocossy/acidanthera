import { vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';

/** Opens a vault note into the editor and moves both region focus and real DOM focus into it
 *  (doc/v0-spec.md §5.3, §6) — `focusEditor` bumps a request nonce so re-opening the buffer that is
 *  already active still re-claims focus from whatever overlay just closed. */
export async function openVaultFile(path: string): Promise<void> {
  const existing = useEditorStore.getState().buffers.find((buffer) => buffer.filePath === path);
  if (existing !== undefined) {
    useEditorStore.getState().activateBuffer(existing.id);
    useAppStore.getState().focusEditor();
    return;
  }

  const content = await vaultService.readNote(path);
  useEditorStore.getState().openFile(path, content);
  useAppStore.getState().focusEditor();
}
