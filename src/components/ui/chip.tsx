import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const chipVariants = cva('inline-flex items-center gap-[5px] rounded-pill border px-[10px] py-[3px] font-mono text-label', {
  variants: {
    variant: {
      plain: 'border-border bg-elevated text-text-secondary',
      context: 'border-border bg-elevated text-text-secondary',
      add: 'border-dashed border-border bg-transparent text-text-muted',
      model: 'border-accent bg-accent-soft text-text-primary',
      ai: 'border-transparent bg-accent-soft text-accent',
    },
  },
  defaultVariants: {
    variant: 'plain',
  },
});

const chipPrefixes = {
  context: '◈ ',
  add: '＋ ',
} as const;

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {}

/** A mono pill used for context, add affordances, models, and AI presence. */
export function Chip({ className, variant, children, ...props }: ChipProps) {
  const prefix = variant === 'context' || variant === 'add' ? chipPrefixes[variant] : undefined;
  return (
    <span className={cn(chipVariants({ variant, className }))} {...props}>
      {prefix}
      {children}
    </span>
  );
}
