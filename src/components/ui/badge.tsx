import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/** Square mono label chip, intentionally distinct from Chip's pill shape. */
const badgeVariants = cva('inline-flex items-center rounded-kbd border px-1.5 py-0.5 font-mono text-label uppercase tracking-label', {
  variants: {
    tone: {
      muted: 'border-border bg-transparent text-text-muted',
      plain: 'border-border bg-transparent text-text-secondary',
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
