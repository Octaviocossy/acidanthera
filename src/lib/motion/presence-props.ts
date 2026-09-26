import type { HTMLMotionProps, Transition } from 'motion/react';
import { DURATION, EXIT_RATIO, enterTransition, exitTransition } from '@/lib/motion/tokens';

/** The enter/exit half of a motion element's props: what an `AnimatePresence` child spreads. */
export type PresenceProps = Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'>;

/**
 * A list item that grows in and collapses out along one axis (a tree row on `height`, a tab chip on
 * `width`), fading as it goes on `--dur` (decision 13): the enter decelerates, and the exit
 * accelerates at ~70%. Under Reduce Motion the size never tweens (decision 5). It snaps open at
 * once, and on exit holds until the fade is done, then snaps shut, so the fade is still seen.
 */
export function collapsePresence(axis: 'height' | 'width', reduceMotion: boolean): PresenceProps {
  const size = (value: number | 'auto') => (axis === 'height' ? { height: value } : { width: value });
  const sizeEnter: Transition = reduceMotion ? { duration: 0 } : enterTransition('base');
  const sizeExit: Transition = reduceMotion ? { duration: 0, delay: DURATION.base * EXIT_RATIO } : exitTransition('base');
  const perValue = (sizeTransition: Transition, opacity: Transition): Transition => (axis === 'height' ? { height: sizeTransition, opacity } : { width: sizeTransition, opacity });
  return {
    initial: { ...size(0), opacity: 0 },
    animate: { ...size('auto'), opacity: 1, transition: perValue(sizeEnter, enterTransition('base')) },
    exit: { ...size(0), opacity: 0, transition: perValue(sizeExit, exitTransition('base')) },
  };
}

/** Two layers swapping in one slot, the agent panel's Chat ↔ History (decision 22): a crossfade on
 *  `--dur-fast`, the state-change step, because switching a tab is a state change. */
export const crossfadePresence: PresenceProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: enterTransition('fast') },
  exit: { opacity: 0, transition: exitTransition('fast') },
};
