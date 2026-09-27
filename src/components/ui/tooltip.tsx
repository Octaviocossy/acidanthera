import { type HTMLMotionProps, motion } from 'motion/react';
import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

/** The motion props a host may drive. The primitive stays store-free and position-taking. */
type TooltipMotionProps = Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'variants'>;

export interface TooltipProps extends TooltipMotionProps {
  content: ReactNode;
  left: number;
  top: number;
  /** Laid out but invisible for the measure frame, mirroring SidebarContextMenu. */
  hidden?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** The drawn hover reveal's panel. Pure and position-taking: the host owns measurement and motion. */
export function Tooltip({ content, left, top, hidden = false, ref, initial, animate, exit, variants }: TooltipProps) {
  return (
    <motion.div
      ref={ref}
      role="tooltip"
      style={hidden ? { visibility: 'hidden' } : { left, top }}
      className={cn(
        'pointer-events-none absolute flex max-w-[240px] items-center gap-2 rounded-item border border-border bg-elevated px-2 py-1 font-sans text-meta text-text-primary',
        '[[data-theme=light]_&]:shadow-[var(--shadow-popover-light)]'
      )}
      initial={initial}
      animate={animate}
      exit={exit}
      variants={variants}
    >
      {content}
    </motion.div>
  );
}
