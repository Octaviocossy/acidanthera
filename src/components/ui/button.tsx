import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border font-mono transition-colors duration-[var(--dur)] ease-orbit disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-active',
  {
    variants: {
      variant: {
        primary: 'border-border-active bg-surface-2 text-text hover:bg-border-active',
        ghost: 'border-transparent bg-transparent text-text hover:bg-surface-2',
        quiet: 'border-transparent bg-transparent text-text-dim hover:text-text',
      },
      size: {
        sm: 'h-6 px-2 text-xs',
        md: 'h-8 px-3 text-sm',
      },
      kbd: {
        true: 'h-5 rounded-sm border-border bg-surface px-1.5 text-xs text-text-dim',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
      kbd: false,
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, kbd, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, kbd, className }))} {...props} />;
}
