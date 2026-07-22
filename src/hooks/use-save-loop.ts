import { useEffect, useRef } from 'react';
import { saveBuffer } from '@/lib/editor/save-buffer';
import { useEditorStore } from '@/stores/editor-store';
import { useToastStore } from '@/stores/toast-store';

/** Drains immutable buffer save requests in order, preserving the buffer targeted by each request. */
export function useSaveLoop() {
  const saveRequestCount = useEditorStore((state) => state.saveRequests.length);
  const saving = useRef(false);

  useEffect(() => {
    if (saveRequestCount === 0 || saving.current) return;

    saving.current = true;
    void (async () => {
      while (true) {
        const request = useEditorStore.getState().saveRequests[0];
        if (request === undefined) break;

        const fileName = request.filePath.split('/').pop() ?? request.filePath;
        try {
          await saveBuffer(request);
          useEditorStore.getState().completeSaveRequest(request);
          useToastStore.getState().showToast(`Saved ${fileName}`);
        } catch (err) {
          useEditorStore.getState().failSaveRequest(request.id);
          useToastStore.getState().showToast(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      }
      saving.current = false;
    })();
  }, [saveRequestCount]);
}
