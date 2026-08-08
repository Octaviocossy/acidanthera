import { cn } from '@/lib/utils';

export interface SegmentedProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}

/** A controlled row of mutually exclusive mono options. */
export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div className="flex gap-[6px]">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            className={cn(
              'rounded-item border px-3 py-1.5 font-mono text-[11px]',
              active ? 'border-accent bg-accent-soft text-text-primary' : 'border-border bg-transparent text-text-secondary'
            )}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
