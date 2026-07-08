import { useEffect } from 'react';
import { vaultService } from '@/services/vault.service';
import { useEditorStore } from '@/stores/editor-store';

/**
 * Persists the editor to disk whenever `:w` / `Mod-s` bump `saveIntent` (doc/v0-spec.md §5.1,
 * §5.3). No-ops for the scratch buffer (`filePath === null`) — v0 has no "save as" flow.
 */
export function useSaveLoop() {
  const saveIntent = useEditorStore((state) => state.saveIntent);

  useEffect(() => {
    if (saveIntent === 0) return;

    const { filePath, content, markSaved } = useEditorStore.getState();
    if (filePath === null) return;

    vaultService.writeNote(filePath, content).then(markSaved);
  }, [saveIntent]);
}
