import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  boxed?: boolean;
}

/** A keyboard hint. `boxed` draws the chip; bare is used inline in footers. */
export function Kbd({ className, boxed = true, ...props }: KbdProps) {
  return <kbd className={cn('whitespace-nowrap font-mono text-micro text-text-muted', boxed && 'rounded-kbd border border-border px-[7px] py-[2px]', className)} {...props} />;
}
