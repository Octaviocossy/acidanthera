import type { Transition } from 'motion/react';

/**
 * The *motion tokens* of `src/styles/tokens/motion.css`, mirrored for Motion, which takes numbers
 * rather than CSS variables: durations in **seconds**, curves as cubic-bezier control points. Never
 * write a duration or a curve literal in a component; read it from here (Motion) or from the CSS
 * variable (a Tailwind class). `tokens.test.ts` reads the CSS file and fails when the two drift —
 * the toast's 160ms `FADE_MS` against a 180ms `--dur` is that drift, already shipped once (spec
 * decision 26).
 */
export const DURATION = {
  /** `--dur-fast`: state and hover. */
  fast: 0.12,
  /** `--dur`: overlays and lists. */
  base: 0.18,
  /** `--dur-slow`: panels and scroll. */
  slow: 0.24,
} as const;

export const EASE = {
  /** `--ease`: symmetric, for a CSS transition with no enter or exit direction. */
  standard: [0.4, 0, 0.2, 1],
  /** `--ease-out`: an enter, decelerating into place. */
  out: [0, 0, 0.2, 1],
  /** `--ease-in`: an exit, accelerating away. */
  in: [0.4, 0, 1, 1],
} as const;

/** An exit lasts this fraction of its enter, which is what reads as smooth rather than floaty (decision 13). */
export const EXIT_RATIO = 0.7;

export type DurationStep = keyof typeof DURATION;

/** An enter: the full step, decelerating. Expanding the sidebar and opening a panel are enters. */
export function enterTransition(step: DurationStep): Transition {
  return { duration: DURATION[step], ease: EASE.out };
}

/** An exit: ~70% of the step, accelerating. Collapsing the sidebar and closing a panel are exits. */
export function exitTransition(step: DurationStep): Transition {
  return { duration: DURATION[step] * EXIT_RATIO, ease: EASE.in };
}
