import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps an Orbit font-size step alongside a text color', () => {
    // Regression guard: tailwind-merge classified `text-micro` as a *color* and dropped it, so
    // every primitive setting a size and a color together rendered at the inherited body size.
    expect(cn('font-mono text-micro', 'text-text-primary')).toBe('font-mono text-micro text-text-primary');
  });

  it('keeps every step of the scale against a color', () => {
    for (const step of ['micro', 'label', 'meta', 'caption', 'ui', 'body', 'input', 'h2', 'h1', 'display']) {
      expect(cn(`text-${step}`, 'text-text-muted')).toBe(`text-${step} text-text-muted`);
    }
  });

  it('still collapses two competing font sizes to the last one', () => {
    expect(cn('text-label', 'text-micro')).toBe('text-micro');
  });

  it('still collapses two competing text colors to the last one', () => {
    expect(cn('text-text-muted', 'text-text-primary')).toBe('text-text-primary');
  });

  it('leaves Tailwind’s own size scale working', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    expect(cn('text-sm', 'text-red-500')).toBe('text-sm text-red-500');
  });
});
