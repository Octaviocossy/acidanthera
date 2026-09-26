import type { Transition } from 'motion/react';
import { describe, expect, it } from 'vitest';
import { collapsePresence, crossfadePresence } from '@/lib/motion/presence-props';
import { DURATION, EXIT_RATIO, enterTransition, exitTransition } from '@/lib/motion/tokens';

interface PlainAnimate {
  transition: Record<string, Transition>;
}

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
