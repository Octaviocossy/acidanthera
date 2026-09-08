import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: ReactNode;
  left: number;
  top: number;
  /** Laid out but invisible for the measure frame, mirroring SidebarContextMenu. */
  hidden?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** The drawn hover reveal's panel. Pure and position-taking: the host owns measurement. */
export function Tooltip({ content, left, top, hidden = false, ref }: TooltipProps) {
  return (
    <div
      ref={ref}
      role="tooltip"
      style={hidden ? { visibility: 'hidden' } : { left, top }}
      className={cn(
        'pointer-events-none absolute flex max-w-[240px] items-center gap-2 rounded-item border border-border bg-elevated px-2 py-1 font-sans text-meta text-text-primary',
        '[[data-theme=light]_&]:shadow-[var(--shadow-popover-light)]'
      )}
    >
      {content}
    </div>
  );
}
