import type * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** A controlled, accessible pill toggle. */
export function Switch({ checked, onCheckedChange, className, onClick, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn('relative h-5 w-[34px] rounded-pill transition-[background-color] duration-[150ms] ease-[ease]', checked ? 'bg-accent' : 'bg-border-strong', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      {...props}
    >
      <span
        className={cn('absolute top-[2px] h-4 w-4 rounded-pill transition-[left] duration-[150ms] ease-[ease]', checked ? 'left-4 bg-accent-on' : 'left-[2px] bg-text-muted')}
      />
    </button>
  );
}
