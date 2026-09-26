import type { Transition } from 'motion/react';
import { enterTransition, exitTransition } from '@/lib/motion/tokens';

/** Opening the agent panel or expanding the sidebar: an enter — `--dur-slow`, decelerating (decision 13). */
export const PANEL_OPEN: Transition = enterTransition('slow');
/** Closing or collapsing: an exit — ~70% of `--dur-slow`, accelerating. */
export const PANEL_CLOSE: Transition = exitTransition('slow');
/** A width the pointer drives, or any width under Reduce Motion (decisions 5, 12). */
export const PANEL_INSTANT: Transition = { duration: 0 };

export type PanelGesture = 'open' | 'close';

export function panelTransition(gesture: PanelGesture, instant: boolean): Transition {
  if (instant) return PANEL_INSTANT;
  return gesture === 'open' ? PANEL_OPEN : PANEL_CLOSE;
}
