import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useRef } from 'react';
import { collapsePresence } from '@/lib/motion/presence-props';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { useReleaseFocusOnExit } from '@/lib/motion/use-release-focus-on-exit';

const ROW_PRESENCE = { full: collapsePresence('height', false), reduced: collapsePresence('height', true) };

/**
 * One sidebar tree row as an `AnimatePresence` child (decision 2): grows in, collapses out, and is
 * inert with any focused input blurred from its first exit frame (invariant 60). `overflow-clip`
 * is no scroll container, so an input focusing in a growing row cannot scroll it. `shrink-0`,
 * because clipping zeroes a flex item's automatic minimum height and the tree would squash rows.
 */
export function AnimatedTreeRow({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion() === true;
  const { exiting, exitPhaseProps } = useExitPhase();
  const ref = useRef<HTMLDivElement>(null);
  useReleaseFocusOnExit(ref, exiting);
  const presence = reduceMotion ? ROW_PRESENCE.reduced : ROW_PRESENCE.full;
  return (
    <motion.div
      ref={ref}
      className="shrink-0 overflow-clip"
      style={exitPhaseProps.style}
      inert={exitPhaseProps.inert}
      initial={presence.initial}
      animate={presence.animate}
      exit={presence.exit}
    >
      {children}
    </motion.div>
  );
}
