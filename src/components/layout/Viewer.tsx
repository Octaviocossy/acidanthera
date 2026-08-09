import { useState } from 'react';
import { BufferEditor } from '@/components/editor/BufferEditor';
import { CloseBufferDialog } from '@/components/editor/CloseBufferDialog';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { Kbd } from '@/components/ui/kbd';
import { saveBuffer } from '@/lib/editor/save-buffer';
import { cn } from '@/lib/utils';
import { displayPath } from '@/lib/vault/display-path';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { activeEditorBuffer, createEditorSaveRequest, useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

function hasVaultNotes(entries: readonly VaultEntry[]): boolean {
  return entries.some((entry) => !entry.isDir || (entry.children !== null && hasVaultNotes(entry.children)));
}

/** The editor region, keeping every open buffer mounted to retain CodeMirror state. */
export function Viewer() {
  const isActive = useAppStore((state) => state.activeRegion === 'viewer');
  const buffers = useEditorStore((state) => state.buffers);
  const activeBufferId = useEditorStore((state) => state.activeBufferId);
  const cursor = useEditorStore((state) => state.cursor);
  const vimMode = useEditorStore((state) => activeEditorBuffer(state)?.vimMode);
  const activateBuffer = useEditorStore((state) => state.activateBuffer);
  const closeBuffer = useEditorStore((state) => state.closeBuffer);
  const completeSaveRequest = useEditorStore((state) => state.completeSaveRequest);
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const vaultTree = useSidebarStore((state) => state.tree);
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
    <main aria-label="Editor" className={cn('relative flex h-full flex-1 flex-col overflow-hidden border-t bg-canvas', isActive ? 'border-border-strong' : 'border-transparent')}>
      <EditorTabs buffers={buffers} activeBufferId={activeBufferId} onActivate={activateBuffer} onClose={requestClose} />
      <div className="min-h-0 flex-1">
        {buffers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="font-sans text-display font-medium text-text-primary tracking-display">orbit</span>
            <span className="font-sans text-ui text-text-secondary">{!hasVaultNotes(vaultTree) ? 'Your vault is empty. Good — clean slate.' : 'No note open.'}</span>
            <span className="font-mono text-meta text-text-muted">{vaultRoot === null ? '' : displayPath(vaultRoot)}</span>
            <Kbd>Ctrl-w f</Kbd>
          </div>
        ) : (
          buffers.map((buffer) => <BufferEditor key={buffer.id} buffer={buffer} active={buffer.id === activeBufferId} />)
        )}
      </div>
      {activeBufferId !== null && (
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2">
          <span className="font-mono text-meta text-text-muted">
            ln {cursor.line} · col {cursor.col}
          </span>
          {vimMode !== undefined && <span className="font-mono text-meta uppercase tracking-label text-text-muted">{vimMode}</span>}
        </div>
      )}
      <CloseBufferDialog
        buffer={closingBuffer ?? null}
        onSave={saveAndClose}
        onDiscard={() => {
          if (closingBuffer === undefined) return;
          closeBuffer(closingBuffer.id);
          setClosingBufferId(null);
        }}
        onCancel={() => setClosingBufferId(null)}
      />
    </main>
  );
}
