import { useEffect } from 'react';
import { vaultService } from '@/services/vault.service';
import { useEditorStore } from '@/stores/editor-store';
import { useToastStore } from '@/stores/toast-store';

/**
 * Persists the editor to disk whenever `:w` / `Mod-s` bump `saveIntent` (doc/v0-spec.md §5.1,
 * §5.3) and surfaces the outcome as a toast (#27). No-ops for the scratch buffer
 * (`filePath === null`) — v0 has no "save as" flow.
 */
export function useSaveLoop() {
  const saveIntent = useEditorStore((state) => state.saveIntent);

  useEffect(() => {
    if (saveIntent === 0) return;

    const { filePath, content, markSaved } = useEditorStore.getState();
    if (filePath === null) return;

    const { showToast } = useToastStore.getState();
    const fileName = filePath.split('/').pop() ?? filePath;

    vaultService
      .writeNote(filePath, content)
      .then(() => {
        markSaved();
        showToast(`Saved ${fileName}`);
      })
      .catch((err: unknown) => {
        showToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      });
  }, [saveIntent]);
}
