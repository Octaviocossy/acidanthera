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

/** Tool-call chip — spinner while running, check on success, error on failure (doc/v0-spec.md §5.6). */
export function ToolChip({ verb, path, status }: ToolChipProps) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-xs',
        status === 'error' ? 'border-border-active text-text' : 'border-border-hairline text-text-dim'
      )}
    >
      <span className={cn('shrink-0', status === 'running' && 'animate-pulse')} aria-hidden="true">
        {STATUS_GLYPH[status]}
      </span>
      <span className="shrink-0 uppercase tracking-caps">{verb}</span>
      {path && <span className="truncate text-text-faint">{path}</span>}
    </div>
  );
}
