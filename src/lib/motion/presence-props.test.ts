import type { Transition } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { PANEL_SECONDS } from '@/lib/layout/panel-motion';
import { collapsePresence, crossfadePresence, fadePresence, panelFramePresence, sequencedFacePresence } from '@/lib/motion/presence-props';
import { DURATION, EXIT_RATIO, enterTransition, exitTransition } from '@/lib/motion/tokens';

interface PlainAnimate {
  transition: Record<string, Transition>;
}

type Timed = { transition: { duration: number; delay?: number } };

describe('collapsePresence', () => {
  it("tweens a row's height on the list step, entering decelerated and leaving at 70%", () => {
    const presence = collapsePresence('height', false);
    const animateTransition = (presence.animate as unknown as PlainAnimate).transition;
    const exitTransitionValue = (presence.exit as unknown as PlainAnimate).transition;

    expect(animateTransition.height).toEqual(enterTransition('base'));
    expect(exitTransitionValue.height).toEqual(exitTransition('base'));
  });

  it('snaps the size under Reduce Motion but keeps the fade', () => {
    const presence = collapsePresence('width', true);
    const animateTransition = (presence.animate as unknown as PlainAnimate).transition;
    const exitTransitionValue = (presence.exit as unknown as PlainAnimate).transition;

    expect((animateTransition.width as { duration: number }).duration).toBe(0);
    expect((exitTransitionValue.width as { delay: number }).delay).toBe(DURATION.base * EXIT_RATIO);
    expect(animateTransition.opacity).toEqual(enterTransition('base'));
  });
});

describe('crossfadePresence', () => {
  it('crossfades on the state step', () => {
    const transition = (crossfadePresence.animate as unknown as { transition: { duration: number } }).transition;
    expect(transition.duration).toBe(DURATION.fast);
  });
});

describe('fadePresence', () => {
  it('enters from transparent on the given enter and leaves on the given exit', () => {
    const enter = enterTransition('slow');
    const exit = exitTransition('slow');
    const presence = fadePresence(enter, exit);
    expect(presence.initial).toEqual({ opacity: 0 });
    expect(presence.animate).toEqual({ opacity: 1, transition: enter });
    expect(presence.exit).toEqual({ opacity: 0, transition: exit });
  });
});

describe('sequencedFacePresence', () => {
  it('fades in over the second half of the gesture that brings the face', () => {
    const { transition } = sequencedFacePresence('open', 'close').animate as unknown as Timed;
    expect(transition.delay).toBeCloseTo(PANEL_SECONDS.open / 2);
    expect(transition.duration).toBeCloseTo(PANEL_SECONDS.open / 2);
  });

  it('fades out over the first half of the gesture that removes it, at once', () => {
    const { transition } = sequencedFacePresence('open', 'close').exit as unknown as Timed;
    expect(transition.delay).toBeUndefined();
    expect(transition.duration).toBeCloseTo(PANEL_SECONDS.close / 2);
  });

  it('comes back mid-exit with no wait', () => {
    const { reenter } = sequencedFacePresence('open', 'close');
    expect(reenter).not.toHaveProperty('delay');
  });

  it('never shows both faces: in each gesture, the leaving face is gone before the entering one starts', () => {
    const explorer = sequencedFacePresence('open', 'close');
    const rail = sequencedFacePresence('close', 'open');
    // Expanding: the rail leaves while the explorer arrives.
    expect((rail.exit as unknown as Timed).transition.duration).toBeLessThanOrEqual((explorer.animate as unknown as Timed).transition.delay ?? 0);
    // Collapsing: the explorer leaves while the rail arrives.
    expect((explorer.exit as unknown as Timed).transition.duration).toBeLessThanOrEqual((rail.animate as unknown as Timed).transition.delay ?? 0);
  });
});

describe('panelFramePresence', () => {
  it('opens from a zero width to the frame width on the open gesture, and closes to zero', () => {
    const presence = panelFramePresence(348, false);
    expect(presence.initial).toEqual({ width: 0 });
    expect(presence.animate).toEqual({ width: 348, transition: enterTransition('slow') });
    expect(presence.exit).toEqual({ width: 0, transition: exitTransition('slow') });
  });

  it('follows at once for a live drag or Reduce Motion', () => {
    const presence = panelFramePresence(348, true);
    expect((presence.animate as unknown as Timed).transition.duration).toBe(0);
  });
});

describe('every presence helper', () => {
  it('declares a hidden enter state rather than skipping the enter', () => {
    const all = [
      collapsePresence('height', false),
      collapsePresence('width', true),
      crossfadePresence,
      fadePresence(enterTransition('base'), exitTransition('base')),
      sequencedFacePresence('close', 'open'),
      panelFramePresence(348, false),
    ];
    for (const presence of all) expect(presence.initial).toBeTypeOf('object');
  });
});
