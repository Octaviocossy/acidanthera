import '@testing-library/jest-dom/vitest';
import { MotionGlobalConfig } from 'motion/react';

// Every Motion animation lands on its target at once, so a component test never waits out a real
// duration: an exiting element unmounts on the next animation frame. It does NOT make an exit
// synchronous — an `AnimatePresence` child still renders once in its *exit phase* before it goes,
// which is exactly where invariant 60's inertness is asserted, in the same act() as the close.
MotionGlobalConfig.skipAnimations = true;
