import { BufferEditor } from '@/components/editor/BufferEditor';
import { ReadView } from '@/components/editor/ReadView';
import { cn } from '@/lib/utils';
import type { EditorBuffer } from '@/stores/editor-store';

interface BufferPaneProps {
  buffer: EditorBuffer;
  active: boolean;
}

/**
 * One open buffer's slot in the editor card, holding **both** of its surfaces with the inactive one
 * hidden (spec decision 6) — the pattern `Viewer` already uses across buffers, applied within one.
 * Swapping them instead would unmount CodeMirror on every toggle and take undo history and cursor
 * position with it, the exact failure `keymap-compartment.ts` exists to avoid.
 *
 * The pane, not either surface, owns the `editor-buffer-<id>` tabpanel that `EditorTabs`'
 * `aria-controls` points at: two elements cannot share one DOM id, so the id moves up a level the
 * moment a buffer has two surfaces.
 */
export function BufferPane({ buffer, active }: BufferPaneProps) {
  return (
    <div id={`editor-buffer-${buffer.id}`} role="tabpanel" className={cn('h-full min-h-0', active ? 'block' : 'hidden')}>
      <BufferEditor buffer={buffer} active={active} hidden={buffer.view !== 'edit'} />
      <ReadView buffer={buffer} active={active} hidden={buffer.view !== 'read'} />
    </div>
  );
}
