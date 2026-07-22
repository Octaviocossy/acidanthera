import { BufferEditor } from '@/components/editor/BufferEditor';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { activeEditorBuffer, useEditorStore } from '@/stores/editor-store';

/** The editor region, keeping every open buffer mounted to retain CodeMirror state. */
export function Viewer() {
  const isActive = useAppStore((state) => state.activeRegion === 'viewer');
  const buffers = useEditorStore((state) => state.buffers);
  const activeBufferId = useEditorStore((state) => state.activeBufferId);
  const vimMode = useEditorStore((state) => activeEditorBuffer(state).vimMode);

  return (
    <main aria-label="Editor" className={cn('relative flex h-full flex-1 flex-col overflow-hidden border-t-2 bg-bg', isActive ? 'border-border-active' : 'border-transparent')}>
      <div className="min-h-0 flex-1">
        {buffers.map((buffer) => (
          <BufferEditor key={buffer.id} buffer={buffer} active={buffer.id === activeBufferId} />
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3">
        <Badge tone="muted">{vimMode}</Badge>
      </div>
    </main>
  );
}
