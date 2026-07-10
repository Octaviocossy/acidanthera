import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/* Factory mono label chip (DESIGN.md): Geist Mono 12px uppercase, tight tracking, hairline
   border, no fill — see the accent discipline note in `.agents/ubiquitous-language.md`. */
const badgeVariants = cva('inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-xs uppercase tracking-caps', {
  variants: {
    tone: {
      muted: 'border-border bg-transparent text-text-dim',
      plain: 'border-border bg-transparent text-text',
      /* Reserved — per accent discipline this tone is, in practice, never used anywhere in
         v0 but the AiFab. */
      accent: 'border-fab-accent bg-transparent text-fab-accent',
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
