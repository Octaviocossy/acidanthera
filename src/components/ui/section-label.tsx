import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  ai?: boolean;
}

/** An all-caps mono section label, optionally marking AI-owned content. */
export function SectionLabel({ ai = false, className, children, ...props }: SectionLabelProps) {
  return (
    <span className={cn('font-mono text-label font-medium uppercase tracking-label', ai ? 'text-accent' : 'text-text-muted', className)} {...props}>
      {ai && '✦ '}
      {children}
    </span>
  );
}
