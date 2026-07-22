import { cn } from '@/lib/utils';
import type { EditorBuffer } from '@/stores/editor-store';

interface EditorTabsProps {
  buffers: readonly EditorBuffer[];
  activeBufferId: string;
  onActivate: (bufferId: string) => void;
  onClose: (bufferId: string) => void;
}

/** Accessible session-buffer navigation, kept separate from the mounted editor views. */
export function EditorTabs({ buffers, activeBufferId, onActivate, onClose }: EditorTabsProps) {
  return (
    <div role="tablist" aria-label="Open files" className="flex shrink-0 overflow-x-auto border-b border-border-hairline bg-surface">
      {buffers.map((buffer) => {
        const active = buffer.id === activeBufferId;
        return (
          <div key={buffer.id} className={cn('flex shrink-0 border-r border-border-hairline', active && 'bg-surface-2')}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`editor-buffer-${buffer.id}`}
              aria-label={buffer.dirty ? `${buffer.title}, unsaved changes` : buffer.title}
              className="flex h-8 items-center gap-1 px-3 font-mono text-xs text-text-dim outline-none focus-visible:ring-1 focus-visible:ring-border-active"
              onClick={() => onActivate(buffer.id)}
            >
              <span>{buffer.title}</span>
              {buffer.dirty && <span aria-hidden="true">*</span>}
            </button>
            <button
              type="button"
              className="px-2 font-mono text-text-faint text-xs outline-none hover:text-text focus-visible:ring-1 focus-visible:ring-border-active"
              aria-label={`Close ${buffer.title}`}
              onClick={() => onClose(buffer.id)}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
