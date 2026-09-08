import type { PointerEvent, ReactNode } from 'react';
import { hasModalOverlay } from '@/lib/keymap/modal-overlay';

export interface TooltipState {
  content: ReactNode;
  /** Viewport rect of the hovered target, converted to layer-local by the host. */
  rect: DOMRect;
}

const OPEN_DELAY_MS = 500;
const WARM_WINDOW_MS = 300;

let current: TooltipState | null = null;
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

export function getTooltip(): TooltipState | null {
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
    current = state;
    emit();
    return;
  }
  openTimer = window.setTimeout(() => {
    openTimer = null;
    // Re-checked on fire, not only on request: a dialog opened by keyboard during the delay
    // pushes an overlay without a mousedown, and this tooltip must never open above it.
    if (hasModalOverlay()) return;
    current = state;
    emit();
  }, OPEN_DELAY_MS);
}

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
  const { whenTruncated = false } = options;
  return {
    onPointerEnter: (event) => {
      const element = event.currentTarget;
      if (whenTruncated && !isClipped(element)) return;
      requestTooltip({ content, rect: element.getBoundingClientRect() });
    },
    onPointerLeave: hideTooltip,
  };
}
