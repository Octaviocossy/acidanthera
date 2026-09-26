import { waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { clampScrollTop, pendingScrollTop, smoothScrollTo, stepScroll } from './smooth-scroll';

/** A detached `div` whose scroll geometry is fixed, and whose `scrollTop` records every write. Unlike
 *  a real element it does not clamp, so the helper's own clamp is what these tests observe. */
function fakeScrollContainer({ scrollTop = 500, clientHeight = 200, scrollHeight = 2000 } = {}): { el: HTMLElement; writes: number[] } {
  const el = document.createElement('div');
  const writes: number[] = [];
  let top = scrollTop;
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = value;
      writes.push(value);
    },
    configurable: true,
  });
  return { el, writes };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `body` with Motion's real 240ms tween instead of the Vitest setup's skipped one. */
async function withRealTweens(body: () => Promise<void>): Promise<void> {
  const previous = MotionGlobalConfig.skipAnimations;
  MotionGlobalConfig.skipAnimations = false;
  try {
    await body();
  } finally {
    MotionGlobalConfig.skipAnimations = previous;
  }
}

describe('clampScrollTop', () => {
  it('clamps a negative target to 0', () => {
    const { el } = fakeScrollContainer();
    expect(clampScrollTop(el, -50)).toBe(0);
  });

  it('clamps a target past the end to scrollHeight - clientHeight', () => {
    const { el } = fakeScrollContainer({ clientHeight: 200, scrollHeight: 2000 });
    expect(clampScrollTop(el, 5000)).toBe(1800);
  });

  it('clamps to 0 when the content is shorter than the viewport', () => {
    const { el } = fakeScrollContainer({ scrollTop: 0, clientHeight: 800, scrollHeight: 300 });
    expect(clampScrollTop(el, 100)).toBe(0);
  });
});

describe('smoothScrollTo', () => {
  it('lands on the clamped target in one synchronous write under reduced motion', () => {
    const { el, writes } = fakeScrollContainer({ clientHeight: 200, scrollHeight: 2000 });

    smoothScrollTo(el, 5000, { reducedMotion: true });

    expect(el.scrollTop).toBe(1800);
    expect(writes).toEqual([1800]);
  });

  it('reaches the target when motion is allowed', async () => {
    const { el } = fakeScrollContainer();

    smoothScrollTo(el, 1000, { reducedMotion: false });

    await waitFor(() => expect(el.scrollTop).toBe(1000));
    expect(pendingScrollTop(el)).toBe(1000);
  });

  it('reports the target as pending from the moment the jump starts', () => {
    const { el } = fakeScrollContainer();

    smoothScrollTo(el, 1000, { reducedMotion: false });

    expect(pendingScrollTop(el)).toBe(1000);
  });

  it("measures a second quick jump from the first one's target", async () => {
    const { el } = fakeScrollContainer({ scrollTop: 500 });

    smoothScrollTo(el, pendingScrollTop(el) + 100, { reducedMotion: false });
    smoothScrollTo(el, pendingScrollTop(el) + 100, { reducedMotion: false });

    await waitFor(() => expect(el.scrollTop).toBe(700));
  });

  it('eases monotonically from the start to the target, with no overshoot', async () => {
    await withRealTweens(async () => {
      const { el, writes } = fakeScrollContainer({ scrollTop: 500 });

      smoothScrollTo(el, 1000, { reducedMotion: false });
      await waitFor(() => expect(el.scrollTop).toBe(1000));

      expect(writes.length).toBeGreaterThan(2);
      for (let i = 1; i < writes.length; i++) {
        expect(writes[i]).toBeGreaterThanOrEqual(writes[i - 1] as number);
      }
      expect(Math.min(...writes)).toBeGreaterThanOrEqual(500);
      expect(Math.max(...writes)).toBe(1000);
    });
  });

  it('retargets mid-flight from the current position, never snapping back', async () => {
    await withRealTweens(async () => {
      const { el, writes } = fakeScrollContainer({ scrollTop: 500 });

      smoothScrollTo(el, 1000, { reducedMotion: false });
      await wait(100);

      const mid = el.scrollTop;
      const before = writes.length;

      smoothScrollTo(el, pendingScrollTop(el) + 100, { reducedMotion: false });
      await waitFor(() => expect(el.scrollTop).toBe(1100));

      expect(mid).toBeGreaterThan(500);
      expect(Math.min(...writes.slice(before))).toBeGreaterThanOrEqual(mid);
    });
  });

  it('yields to a scroll it did not write', async () => {
    await withRealTweens(async () => {
      const { el } = fakeScrollContainer({ scrollTop: 500 });

      smoothScrollTo(el, 1000, { reducedMotion: false });
      await wait(60);

      el.scrollTop = 42;
      await wait(300);

      expect(el.scrollTop).toBe(42);
      expect(pendingScrollTop(el)).toBe(42);
    });
  });
});

describe('stepScroll', () => {
  it('lands an in-flight jump on its target, then steps from there, and the cancelled jump never writes again', async () => {
    await withRealTweens(async () => {
      const { el } = fakeScrollContainer({ scrollTop: 500 });

      smoothScrollTo(el, 1000, { reducedMotion: false });
      await wait(60);

      stepScroll(el, 24);
      expect(el.scrollTop).toBe(1024);

      await wait(300);
      expect(el.scrollTop).toBe(1024);
    });
  });

  it('clamps the step to the scrollable range', () => {
    const { el } = fakeScrollContainer({ scrollTop: 10 });

    stepScroll(el, -24);

    expect(el.scrollTop).toBe(0);
  });
});
