import { Icon, X } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { EditorBuffer } from '@/stores/editor-store';

interface EditorTabsProps {
  buffers: readonly EditorBuffer[];
  activeBufferId: string | null;
  onActivate: (bufferId: string) => void;
  onClose: (bufferId: string) => void;
}

/** Accessible session-buffer navigation, kept separate from the mounted editor views. */
export function EditorTabs({ buffers, activeBufferId, onActivate, onClose }: EditorTabsProps) {
  if (buffers.length === 0) return null;

  return (
    <div role="tablist" aria-label="Open files" className="flex shrink-0 overflow-x-auto border-b border-hairline bg-panel">
      {buffers.map((buffer) => {
        const active = buffer.id === activeBufferId;
        return (
          <div
            key={buffer.id}
            className={cn(
              'flex shrink-0 border border-transparent border-b-transparent',
              active && '-mb-px border-hairline border-b-canvas bg-canvas text-text-primary',
              !active && 'text-text-muted'
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`editor-buffer-${buffer.id}`}
              aria-label={buffer.dirty ? `${buffer.title}, unsaved changes` : buffer.title}
              className="flex items-center gap-2 px-[14px] py-[7px] font-mono text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
              onClick={() => onActivate(buffer.id)}
            >
              <span>{buffer.title}</span>
              {buffer.dirty && <span aria-hidden="true" className="h-[6px] w-[6px] rounded-pill bg-accent" />}
            </button>
            <button
              type="button"
              className="px-2 text-text-muted outline-none hover:text-text-primary focus-visible:ring-1 focus-visible:ring-border-strong"
              aria-label={`Close ${buffer.title}`}
              onClick={() => onClose(buffer.id)}
            >
              <Icon icon={X} size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
