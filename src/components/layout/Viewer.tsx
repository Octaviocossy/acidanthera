import { useState } from 'react';
import { BufferEditor } from '@/components/editor/BufferEditor';
import { CloseBufferDialog } from '@/components/editor/CloseBufferDialog';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { Badge } from '@/components/ui/badge';
import { saveBuffer } from '@/lib/editor/save-buffer';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { activeEditorBuffer, createEditorSaveRequest, useEditorStore } from '@/stores/editor-store';
import { useToastStore } from '@/stores/toast-store';

/** The editor region, keeping every open buffer mounted to retain CodeMirror state. */
export function Viewer() {
  const isActive = useAppStore((state) => state.activeRegion === 'viewer');
  const buffers = useEditorStore((state) => state.buffers);
  const activeBufferId = useEditorStore((state) => state.activeBufferId);
  const vimMode = useEditorStore((state) => activeEditorBuffer(state).vimMode);
  const activateBuffer = useEditorStore((state) => state.activateBuffer);
  const closeBuffer = useEditorStore((state) => state.closeBuffer);
  const completeSaveRequest = useEditorStore((state) => state.completeSaveRequest);
  const [closingBufferId, setClosingBufferId] = useState<string | null>(null);
  const closingBuffer = buffers.find((buffer) => buffer.id === closingBufferId);

  const requestClose = (bufferId: string) => {
    const buffer = useEditorStore.getState().buffers.find((candidate) => candidate.id === bufferId);
    if (buffer === undefined) return;
    if (!buffer.dirty) {
      closeBuffer(bufferId);
      return;
    }
    setClosingBufferId(bufferId);
  };

  const saveAndClose = async () => {
    if (closingBuffer === undefined) return false;
    const request = createEditorSaveRequest(closingBuffer);
    if (request === undefined) return false;

    try {
      await saveBuffer(request);
      completeSaveRequest(request);
      const current = useEditorStore.getState().buffers.find((buffer) => buffer.id === request.bufferId);
      if (current?.revision !== request.revision) return false;
      closeBuffer(request.bufferId);
      setClosingBufferId(null);
      return true;
    } catch (error) {
      useToastStore.getState().showToast(`Save failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return false;
    }
  };

  return (
    <main aria-label="Editor" className={cn('relative flex h-full flex-1 flex-col overflow-hidden border-t-2 bg-bg', isActive ? 'border-border-active' : 'border-transparent')}>
      <EditorTabs buffers={buffers} activeBufferId={activeBufferId} onActivate={activateBuffer} onClose={requestClose} />
      <div className="min-h-0 flex-1">
        {buffers.map((buffer) => (
          <BufferEditor key={buffer.id} buffer={buffer} active={buffer.id === activeBufferId} />
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3">
        <Badge tone="muted">{vimMode}</Badge>
      </div>
      {closingBuffer !== undefined && (
        <CloseBufferDialog
          buffer={closingBuffer}
          onSave={saveAndClose}
          onDiscard={() => {
            closeBuffer(closingBuffer.id);
            setClosingBufferId(null);
          }}
          onCancel={() => setClosingBufferId(null)}
        />
      )}
    </main>
  );
}
