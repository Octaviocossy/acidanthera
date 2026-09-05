import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * acidanthera's font-size scale lives in `src/styles/tokens/typography.css` and reaches Tailwind as the
 * `--text-*` namespace in `src/styles/index.css`. tailwind-merge cannot see that theme: it treats
 * `text-<name>` as a font size only when the name parses as a t-shirt size (`sm`, `lg`, `2xl`) or
 * an arbitrary length, so every acidanthera step fell through to its *text color* group instead. Two
 * classes in one group collide and the last wins — which meant `cn('text-micro', 'text-text-primary')`
 * returned only the color, and every primitive that sets a size and a color together (`Chip`,
 * `ToolChip`, `Kbd`, `SectionLabel`) silently rendered at the inherited 13.5px body size.
 *
 * Registering the scale here is what makes the type tokens actually take effect. Any new step added
 * to `typography.css` must be added to this list too, or it will be dropped the same way.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'label', 'meta', 'caption', 'ui', 'body', 'input', 'h2', 'h1', 'display'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
