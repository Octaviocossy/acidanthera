import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn border font-sans transition-[color,background-color,border-color] duration-[150ms] ease-[ease] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-accent font-medium text-accent-on',
        secondary: 'border-border bg-transparent font-normal text-text-secondary',
        ghost: 'border-transparent bg-transparent font-normal text-text-secondary',
      },
      size: {
        sm: 'px-3 py-1 text-[11px]',
        md: 'px-[14px] py-[5px] text-ui',
      },
      asKbd: {
        true: 'h-5 rounded-kbd border-border bg-elevated px-1.5 py-0 font-mono text-micro text-text-muted',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
      asKbd: false,
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Trailing key hint rendered inside the button, e.g. "⌘⏎". */
  kbd?: string;
}

export function Button({ className, variant, size, asKbd, kbd, asChild = false, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, asKbd, className }))} {...props}>
      {children}
      {kbd && <span className="font-mono text-micro opacity-70">{kbd}</span>}
    </Comp>
  );
}
