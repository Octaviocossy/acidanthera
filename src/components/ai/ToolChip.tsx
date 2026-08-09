import { cn } from '@/lib/utils';

/** `running|done` from the reference component, extended with `error` (doc/v0-spec.md §4.3, §8). */
export type ToolChipStatus = 'running' | 'done' | 'error';

export interface ToolChipProps {
  verb: string;
  path?: string;
  status: ToolChipStatus;
}

const STATUS_GLYPH: Record<ToolChipStatus, string> = {
  running: '…',
  done: '✓',
  error: '✕',
};

/** Tool-call chip — only an in-flight agent action carries the AI accent. */
export function ToolChip({ verb, path, status }: ToolChipProps) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-pill border px-[10px] py-[3px] font-mono text-label',
        status === 'running' && 'border-accent text-accent',
        status === 'done' && 'border-border bg-elevated text-text-muted',
        status === 'error' && 'border-border-strong bg-elevated text-text-secondary'
      )}
    >
      <span className={cn('shrink-0', status === 'running' && 'animate-pulse')} aria-hidden="true">
        {STATUS_GLYPH[status]}
      </span>
      <span className="shrink-0 uppercase tracking-label">{verb}</span>
      {path && <span className="truncate text-text-muted">{path}</span>}
    </div>
  );
}
