import { useIsPresent } from 'motion/react';
import type { CSSProperties } from 'react';

export interface ExitPhaseProps {
  inert?: boolean;
  style?: CSSProperties;
}

// Module constants, so a consumer memoising on `exitPhaseProps` sees a stable identity per phase.
const EXITING: ExitPhaseProps = { inert: true, style: { pointerEvents: 'none' } };
const PRESENT: ExitPhaseProps = {};

/**
 * True once this `AnimatePresence` child has begun leaving: its *exit phase*. The returned props make
 * it inert at once (invariant 60): `inert` takes it and everything inside out of focus, the keyboard
 * and the accessibility tree, and `pointer-events: none` lets clicks fall through to what it is
 * uncovering. Spread `exitPhaseProps` onto the element that animates out; when that element has a
 * `style` of its own, merge rather than spread: `style={{ ...ownStyle, ...exitPhaseProps.style }}`.
 *
 * Inertness is the floor, not the whole rule. Popping a modal overlay and moving focus to where it
 * belongs stay the consumer's job, done in the same handler as the state change that closed it —
 * never deferred to unmount, which is where the exit phase *ends*.
 *
 * The element's enter/exit props come from `@/lib/motion/presence-props`, never hand-written: an
 * `initial={false}` on a presence child disables every enter, not just the first paint's, which is
 * the parent `AnimatePresence`'s concern.
 *
 * Outside `AnimatePresence` the element is always present, so `exiting` is always false.
 */
export function useExitPhase(): { exiting: boolean; exitPhaseProps: ExitPhaseProps } {
  const exiting = !useIsPresent();
  return { exiting, exitPhaseProps: exiting ? EXITING : PRESENT };
}
