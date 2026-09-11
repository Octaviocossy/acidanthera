import { cn } from '@/lib/utils';

export interface SegmentedProps {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * A controlled row of mutually exclusive mono options — **monochrome**.
 *
 * Its active state was `border-accent bg-accent-soft`, an ember fill on a theme selector asserting
 * no AI agency at all: a standing invariant-21 violation rather than a new one. The primitive is
 * changed outright instead of gaining a monochrome variant (spec decision 17) because neither of
 * its consumers — the settings dialog's theme row or the *view toggle* — should be ember, so a
 * variant would have shipped one dead branch.
 */
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
              active ? 'border-border bg-elevated text-text-primary' : 'border-border bg-transparent text-text-secondary'
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
