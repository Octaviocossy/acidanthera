import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { BufferPane } from '@/components/editor/BufferPane';
import { CloseBufferDialog } from '@/components/editor/CloseBufferDialog';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { HomeSurface } from '@/components/layout/HomeSurface';
import { countWords, readingMinutes } from '@/lib/editor/note-stats';
import { saveBuffer } from '@/lib/editor/save-buffer';
import { enterTransition } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { activeEditorBuffer, createEditorSaveRequest, useEditorStore } from '@/stores/editor-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useToastStore } from '@/stores/toast-store';

/** The home surface's fade-in when the last buffer closes (spec decision 22). */
const HOME_ARRIVAL = enterTransition('slow');

/** The editor region, keeping every open buffer mounted to retain CodeMirror state. */
export function Viewer() {
  const isActive = useAppStore((state) => state.activeRegion === 'viewer');
  const buffers = useEditorStore((state) => state.buffers);
  const activeBufferId = useEditorStore((state) => state.activeBufferId);
  const cursor = useEditorStore((state) => state.cursor);
  const vimMode = useEditorStore((state) => activeEditorBuffer(state)?.vimMode);
  const view = useEditorStore((state) => activeEditorBuffer(state)?.view);
  const content = useEditorStore((state) => activeEditorBuffer(state)?.content ?? '');
  const activateBuffer = useEditorStore((state) => state.activateBuffer);
  const closeBuffer = useEditorStore((state) => state.closeBuffer);
  const completeSaveRequest = useEditorStore((state) => state.completeSaveRequest);
  const contentZoom = useSettingsStore((state) => state.settings?.contentZoom ?? 1);
  const [closingBufferId, setClosingBufferId] = useState<string | null>(null);
  const closingBuffer = buffers.find((buffer) => buffer.id === closingBufferId);

  // Set the first time the viewer holds a buffer and never cleared, so every later return to zero
  // buffers is a last-buffer close — the one arrival that fades. The boot render has never held one,
  // so its home surface paints at once. Adjusted during render (react.dev, "storing information from
  // previous renders"), so the render that drops the last buffer already reads it.
  const hasBuffers = buffers.length > 0;
  const [hasHeldBuffer, setHasHeldBuffer] = useState(hasBuffers);
  if (hasBuffers && !hasHeldBuffer) setHasHeldBuffer(true);

  // Only the read variant of the cluster needs these, and both walk the whole note — so they are
  // memoized on the content rather than recomputed for every cursor movement the edit variant
  // re-renders on.
  const words = useMemo(() => countWords(content), [content]);
  const minutes = useMemo(() => readingMinutes(content), [content]);

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
    // The region column: the tab strip sits on the `bg-panel` ground, the *inset card* below it.
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <EditorTabs buffers={buffers} activeBufferId={activeBufferId} onActivate={activateBuffer} onClose={requestClose} />
      {/* The editor *inset card*: `--bg-canvas` on the panel ground, `--radius-panel`, gutter on the
          right and bottom (the sidebar stays flush to the window edge). Its border carries the focus
          region on all four sides — the card shares no edge with its neighbours, and ADR 0107 already
          spent the region label it would otherwise need. Hairline in both themes, never a shadow: the
          card is inset *into* the ground rather than elevated above it (spec decisions 4, 22, 38). */}
      <main
        aria-label="Editor"
        className={cn('relative mr-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border bg-canvas', isActive ? 'border-border-strong' : 'border-hairline')}
      >
        <div className="min-h-0 flex-1">
          {buffers.length === 0 ? (
            // No AnimatePresence: opening a buffer is a keyboard hot path (decision 3), so the home
            // surface leaves in the same commit the buffer arrives, with no exit phase. The wrapper
            // carries the card's height, because the home surface centers itself in its parent's box:
            // without `h-full` here it collapses to its content and pins itself to the card's top.
            <motion.div className="h-full" initial={hasHeldBuffer ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={HOME_ARRIVAL}>
              <HomeSurface />
            </motion.div>
          ) : (
            buffers.map((buffer) => <BufferPane key={buffer.id} buffer={buffer} active={buffer.id === activeBufferId} />)
          )}
        </div>
        {/* The *editor status cluster*, whose content follows the buffer's *buffer view* while its
            place does not: it stays inside the card in both, because the mockup's full-width gutter
            bar is the status bar ADR 0107 deleted (invariant 23). There is deliberately **no**
            read-mode indicator — the *view toggle* a few inches above is the indicator, the same way
            `CommandBar`'s mere presence is the *global mode indicator* (spec decision 29). */}
        {activeBufferId !== null && (
          <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2">
            {view === 'read' ? (
              <span className="font-mono text-meta text-text-muted">
                {words} words · {minutes} min read
                {contentZoom !== 1 && ` · ${Math.round(contentZoom * 100)}%`}
              </span>
            ) : (
              <>
                <span className="font-mono text-meta text-text-muted">
                  ln {cursor.line} · col {cursor.col}
                  {contentZoom !== 1 && ` · ${Math.round(contentZoom * 100)}%`}
                </span>
                {vimMode !== undefined && <span className="font-mono text-meta uppercase tracking-label text-text-muted">{vimMode}</span>}
              </>
            )}
          </div>
        )}
      </main>
      {/* Outside the card so its `absolute inset-0` scrim still covers the tab strip as well. */}
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
    </div>
  );
}
