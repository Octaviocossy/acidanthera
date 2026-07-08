import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-xs uppercase tracking-caps', {
  variants: {
    tone: {
      muted: 'border-border bg-surface-2 text-text-dim',
      plain: 'border-border bg-transparent text-text',
      /* Capable of rendering lime — per accent discipline (doc/v0-spec.md §5.6) this tone
         is reserved and, in practice, never used anywhere in v0 but the AiFab. */
      accent: 'border-fab-accent-dim bg-fab-accent-dim/20 text-fab-accent',
    },
  },
  defaultVariants: {
    tone: 'muted',
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}
