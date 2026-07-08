import { vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';

/** Opens a vault note into the editor and moves focus to the viewer (doc/v0-spec.md §5.3, §6). */
export async function openVaultFile(path: string): Promise<void> {
  const content = await vaultService.readNote(path);
  useEditorStore.getState().openFile(path, content);
  useAppStore.getState().focusRegion('viewer');
}
