import { describe, expect, it } from 'vitest';
import { DURATION, EASE, EXIT_RATIO } from './tokens';
import { anchoredVariants, OVERLAY_SHIFT_PX, risingPanelVariants, scrimVariants } from './variants';

describe('scrimVariants', () => {
  it('fades without moving', () => {
    expect(scrimVariants.hidden).toEqual({ opacity: 0 });
    expect(scrimVariants.visible).toEqual({ opacity: 1, transition: { duration: DURATION.base, ease: EASE.out } });
  });
});

describe('risingPanelVariants', () => {
  it('starts 4px low and transparent', () => {
    expect(risingPanelVariants.hidden).toEqual({ opacity: 0, y: OVERLAY_SHIFT_PX });
  });

  it('settles at rest on the decelerating curve', () => {
    expect(risingPanelVariants.visible).toEqual({ opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } });
  });

  it('sinks back on a shorter accelerating exit', () => {
    const exit = risingPanelVariants.exit as { opacity: number; y: number; transition: { duration: number; ease: unknown } };
    expect(exit).toMatchObject({ opacity: 0, y: OVERLAY_SHIFT_PX, transition: { ease: EASE.in } });
    expect(exit.transition.duration).toBeCloseTo(DURATION.base * EXIT_RATIO, 6);
  });
});

describe('anchoredVariants', () => {
  it('shifts a left-anchored overlay along x only', () => {
    const variants = anchoredVariants('left');
    expect(variants.hidden).toEqual({ opacity: 0, x: -OVERLAY_SHIFT_PX });
    expect(variants.visible).toMatchObject({ opacity: 1, x: 0 });
  });

  it('shifts a top-anchored overlay along y only', () => {
    const variants = anchoredVariants('top');
    expect(variants.hidden).toEqual({ opacity: 0, y: -OVERLAY_SHIFT_PX });
    expect(variants.visible).toMatchObject({ opacity: 1, y: 0 });
  });
});
