import { animate } from 'motion/react';
import { DURATION, EASE } from '@/lib/motion/tokens';

/**
 * Animated scrolling for a plain scroll container (spec decision 16, ADR 0133): the *read view*'s
 * big jumps glide over `--dur-slow` on `--ease-out` through Motion's `animate(from, to, { onUpdate })`.
 *
 * Invariant 60 shapes every rule here. The position a jump asks for is committed synchronously, as
 * the tween's `target` (`pendingScrollTop`), and only the pixels lag. So:
 * - a second jump measures from the first one's target, and restarts the tween from wherever the
 *   pixels are, never snapping back;
 * - an instant step (`stepScroll`, the `j`/`k` path) first lands an in-flight tween on its target;
 * - a scroll the tween did not write (a wheel, a scrollbar drag, a native key) makes it yield at
 *   once, so the user's own input is never overwritten.
 *
 * No completion callback. Under `MotionGlobalConfig.skipAnimations` (the Vitest setup) Motion
 * resolves `animate`'s top-level `onComplete` a microtask *before* its deferred final `onUpdate`,
 * so cleanup keyed on it would drop the landing write. Arrival is detected in `onUpdate` instead.
 */

/** Past this many pixels between where a tween last wrote `scrollTop` and where the container now
 *  sits, something else moved it, and the tween yields. */
const FOREIGN_SCROLL_TOLERANCE_PX = 1;

/** Within this many pixels of its target a tween counts as arrived: it writes the exact target and
 *  lets go. Also the "already there" threshold for starting one at all. */
const ARRIVAL_TOLERANCE_PX = 0.5;

interface ScrollTween {
  /** Where the tween is headed, already clamped. */
  target: number;
  /** Stops the underlying Motion animation. A no-op until `animate` has returned. */
  stop: () => void;
}

/** The in-flight tween per container. Keyed per container so two scrollers never cancel each
 *  other; a `WeakMap`, so a container that unmounts mid-tween is not kept alive by it. */
const tweens = new WeakMap<HTMLElement, ScrollTween>();

export interface SmoothScrollOptions {
  /** macOS Reduce Motion: the jump lands in one write, with no tween (spec decision 5). */
  reducedMotion: boolean;
}

/** Clamps `top` to the container's scrollable range, `[0, scrollHeight - clientHeight]`. */
export function clampScrollTop(container: HTMLElement, top: number): number {
  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  return Math.min(max, Math.max(0, top));
}

/** Where `container` is headed: its in-flight tween's target, or its `scrollTop` with none. */
export function pendingScrollTop(container: HTMLElement): number {
  return tweens.get(container)?.target ?? container.scrollTop;
}

/** Ends `container`'s tween, if any, leaving `scrollTop` wherever the tween last wrote it. */
function stopTween(container: HTMLElement): ScrollTween | undefined {
  const tween = tweens.get(container);
  if (tween === undefined) return undefined;
  tweens.delete(container);
  tween.stop();
  return tween;
}

/** Stops `container`'s in-flight tween and lands it on the tween's target in one write. */
export function settleScroll(container: HTMLElement): void {
  const tween = stopTween(container);
  if (tween !== undefined) container.scrollTop = tween.target;
}

/** An instant, clamped step of `delta` pixels, taken from the settled position. */
export function stepScroll(container: HTMLElement, delta: number): void {
  settleScroll(container);
  container.scrollTop = clampScrollTop(container, container.scrollTop + delta);
}

/** Animates `container`'s `scrollTop` to `top`, clamped, over `--dur-slow` on `--ease-out`.
 *  Replaces any tween already running on it, starting from wherever that one left the pixels. */
export function smoothScrollTo(container: HTMLElement, top: number, options: SmoothScrollOptions): void {
  const target = clampScrollTop(container, top);
  stopTween(container);

  const from = container.scrollTop;
  if (options.reducedMotion || Math.abs(target - from) < ARRIVAL_TOLERANCE_PX) {
    container.scrollTop = target;
    return;
  }

  const tween: ScrollTween = { target, stop: () => {} };
  const isCurrent = () => tweens.get(container) === tween;
  let lastWritten = from;
  tweens.set(container, tween);

  const controls = animate(from, target, {
    duration: DURATION.slow,
    ease: EASE.out,
    onUpdate: (latest) => {
      if (!isCurrent()) return;
      // Something other than this tween moved the container: the user's input wins (invariant 60).
      if (Math.abs(container.scrollTop - lastWritten) > FOREIGN_SCROLL_TOLERANCE_PX) {
        stopTween(container);
        return;
      }
      if (Math.abs(target - latest) < ARRIVAL_TOLERANCE_PX) {
        stopTween(container);
        container.scrollTop = target;
        return;
      }
      container.scrollTop = latest;
      // Read back rather than keep `latest`: the browser rounds `scrollTop` to device pixels.
      lastWritten = container.scrollTop;
    },
  });
  tween.stop = () => controls.stop();
}
