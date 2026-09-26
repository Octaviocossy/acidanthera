import type { Variants } from 'motion/react';
import { enterTransition, exitTransition } from '@/lib/motion/tokens';

/** How far an overlay travels: enough to show where it came from, never a slide (decision 14). */
export const OVERLAY_SHIFT_PX = 4;

/**
 * The variant labels every overlay shape below uses. Spread onto the animating `motion` element
 * together with its `variants`: `<motion.div variants={scrimVariants} {...overlayPresence} />`.
 */
export const overlayPresence = { initial: 'hidden', animate: 'visible', exit: 'exit' } as const;

/** The shared scrim: opacity only, never a translate. */
export const scrimVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: enterTransition('base') },
  exit: { opacity: 0, transition: exitTransition('base') },
};

/** Dialogs, the file finder and toasts: fade and rise 4px into place, sink back on exit. */
export const risingPanelVariants: Variants = {
  hidden: { opacity: 0, y: OVERLAY_SHIFT_PX },
  visible: { opacity: 1, y: 0, transition: enterTransition('base') },
  exit: { opacity: 0, y: OVERLAY_SHIFT_PX, transition: exitTransition('base') },
};

/**
 * The *Tooltip* and the *sidebar context menu*: fade and shift 4px away from the side they are
 * anchored on. `'left'` for an overlay drawn to the right of its target, `'top'` for one drawn below.
 */
export function anchoredVariants(from: 'left' | 'top'): Variants {
  const offset = from === 'left' ? { x: -OVERLAY_SHIFT_PX } : { y: -OVERLAY_SHIFT_PX };
  const settled = from === 'left' ? { x: 0 } : { y: 0 };
  return {
    hidden: { opacity: 0, ...offset },
    visible: { opacity: 1, ...settled, transition: enterTransition('base') },
    exit: { opacity: 0, ...offset, transition: exitTransition('base') },
  };
}
