import type { PointerEvent, ReactNode } from 'react';
import { hasModalOverlay } from '@/lib/keymap/modal-overlay';

/** Which side of the target the panel opens on. `'right'` (the sidebar's vertical icon stacks)
 *  centers vertically on the target; `'below'` (a horizontal row, such as the *view toggle*)
 *  centers horizontally instead. Defaults to `'right'` so every existing sidebar call site is
 *  unaffected. */
export type TooltipPlacement = 'right' | 'below';

export interface TooltipState {
  content: ReactNode;
  /** Viewport rect of the hovered target, converted to layer-local by the host. */
  rect: DOMRect;
  placement: TooltipPlacement;
}

/** An open tooltip: what was requested, plus how it opened. */
export interface OpenTooltip extends TooltipState {
  /** True when it opened inside the warm window, handed off from a tooltip that just closed. The
   *  host swaps a warm open in place with no animation and fades a cold one in (decision 14). */
  warm: boolean;
}

const OPEN_DELAY_MS = 500;
const WARM_WINDOW_MS = 300;

let current: OpenTooltip | null = null;
let openTimer: number | null = null;
let warmUntil = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeTooltip(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTooltip(): OpenTooltip | null {
  return current;
}

export function cancelPendingTooltip(): void {
  if (openTimer !== null) {
    window.clearTimeout(openTimer);
    openTimer = null;
  }
}

export function requestTooltip(state: TooltipState): void {
  cancelPendingTooltip();
  // A dialog or the context menu is up: it owns the pointer, and a tooltip must not float over it.
  if (hasModalOverlay()) return;

  if (Date.now() < warmUntil) {
    current = { ...state, warm: true };
    emit();
    return;
  }
  openTimer = window.setTimeout(() => {
    openTimer = null;
    // Re-checked on fire, not only on request: a dialog opened by keyboard during the delay
    // pushes an overlay without a mousedown, and this tooltip must never open above it.
    if (hasModalOverlay()) return;
    current = { ...state, warm: false };
    emit();
  }, OPEN_DELAY_MS);
}

/** Ends a hover. The host animates the panel out unless a warm open takes over first. */
export function hideTooltip(): void {
  cancelPendingTooltip();
  // Only a tooltip that actually opened warms the window — an early leave must not.
  if (current === null) return;
  current = null;
  warmUntil = Date.now() + WARM_WINDOW_MS;
  emit();
}

/** Test seam: clears module state between cases. */
export function resetTooltip(): void {
  cancelPendingTooltip();
  current = null;
  warmUntil = 0;
}

/** Exported so a test can assert the rule directly — jsdom reports 0 for both metrics. */
export function isClipped(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth;
}

export interface TooltipTargetOptions {
  /** Text targets only: suppress the reveal when the label already fits. */
  whenTruncated?: boolean;
  /** @default 'right' */
  placement?: TooltipPlacement;
}

export interface TooltipTargetHandlers {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Handlers to spread onto any tooltip target. A plain function, not a hook, so it works
 * inside a `.map()` and after an early return.
 */
export function tooltipTarget(content: ReactNode, options: TooltipTargetOptions = {}): TooltipTargetHandlers {
  const { whenTruncated = false, placement = 'right' } = options;
  return {
    onPointerEnter: (event) => {
      const element = event.currentTarget;
      if (whenTruncated && !isClipped(element)) return;
      requestTooltip({ content, rect: element.getBoundingClientRect(), placement });
    },
    onPointerLeave: hideTooltip,
  };
}
