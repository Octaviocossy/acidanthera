import type { HTMLMotionProps, Transition } from 'motion/react';
import { PANEL_SECONDS, type PanelGesture, panelTransition } from '@/lib/layout/panel-motion';
import { DURATION, EASE, EXIT_RATIO, enterTransition, exitTransition } from '@/lib/motion/tokens';

/**
 * The enter/exit props of every `AnimatePresence` child in the app. A presence child spreads one of
 * these and never writes `initial` by hand, least of all `initial={false}`: on a child that disables
 * **every** enter, not only the first paint's. Skipping the first paint is the parent's job,
 * `<AnimatePresence initial={false}>`. Every helper here therefore declares a hidden `initial`.
 */

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

/** A plain fade in and out of one slot, on whatever enter and exit the caller's gesture uses. */
export function fadePresence(enter: Transition, exit: Transition): PresenceProps {
  return { initial: { opacity: 0 }, animate: { opacity: 1, transition: enter }, exit: { opacity: 0, transition: exit } };
}

/** Two layers swapping in one slot, the agent panel's Chat ↔ History (decision 22): a crossfade on
 *  `--dur-fast`, the state-change step, because switching a tab is a state change. */
export const crossfadePresence: PresenceProps = fadePresence(enterTransition('fast'), exitTransition('fast'));

/** A sequenced face's props, plus the enter it uses when it comes back while still leaving. */
export interface FacePresence extends PresenceProps {
  reenter: Transition;
}

/**
 * One of two faces sharing a slot while a panel's width tweens: the sidebar's explorer and its rail.
 * Sequenced (motion-polish spec decision 1): a face fades out over the first half of the gesture that
 * removes it, and fades in over the second half of the gesture that brings it, so no frame shows
 * both. Both stay mounted, and the entering face is live from frame 0 (invariant 60); only its pixels
 * wait. `reenter` is for a reversal mid-tween (decision 5): no wait, from whatever opacity it reached.
 * Under Reduce Motion the width jumps and these fades remain (motion-spec decision 5).
 */
export function sequencedFacePresence(enterDuring: PanelGesture, exitDuring: PanelGesture): FacePresence {
  const enterHalf = PANEL_SECONDS[enterDuring] / 2;
  const exitHalf = PANEL_SECONDS[exitDuring] / 2;
  const fadeIn: Transition = { duration: enterHalf, ease: EASE.out };
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { ...fadeIn, delay: enterHalf } },
    exit: { opacity: 0, transition: { duration: exitHalf, ease: EASE.in } },
    reenter: fadeIn,
  };
}

/**
 * The agent panel's clipping frame (motion-spec decision 12): opens from a zero width to `width` on
 * the open gesture and closes back to zero on the close gesture. It is instant for a live drag or
 * under Reduce Motion.
 */
export function panelFramePresence(width: number, instant: boolean): PresenceProps {
  return {
    initial: { width: 0 },
    animate: { width, transition: panelTransition('open', instant) },
    exit: { width: 0, transition: panelTransition('close', instant) },
  };
}
