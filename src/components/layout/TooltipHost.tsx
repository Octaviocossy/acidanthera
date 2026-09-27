import { AnimatePresence, type TargetAndTransition } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { anchoredVariants, overlayPresence } from '@/lib/motion/variants';
import { getTooltip, hideTooltip, type OpenTooltip, subscribeTooltip } from '@/lib/tooltip/tooltip-overlay';

const GAP = 8;

/** The panel shifts in from its anchor: from the left beside a target, from above below one (decision 14). */
const VARIANTS = { right: anchoredVariants('left'), below: anchoredVariants('top') } as const;

/** A warm handoff lands at rest in the frame it opens: no fade, no shift (decision 14). */
const SWAP_IN_PLACE: TargetAndTransition = { opacity: 1, x: 0, y: 0, transition: { duration: 0 } };

interface Position {
  /** The open this was measured for; any other open is still in its measure frame. */
  measuredFor: OpenTooltip;
  left: number;
  top: number;
}

/** Draws the hover reveal outside the scrollable explorer so it cannot be clipped (ADR 0111). */
export function TooltipHost() {
  const state = useSyncExternalStore(subscribeTooltip, getTooltip, getTooltip);
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  // Bumped by a dismissal. Re-keying the presence boundary drops the panel with no exit phase.
  const [dismissals, setDismissals] = useState(0);
  const positioned = state !== null && position?.measuredFor === state;

  useLayoutEffect(() => {
    // Null means the panel is exiting or gone. An exiting panel keeps the props it last rendered with.
    if (state === null) return;
    const layer = layerRef.current;
    const panel = panelRef.current;
    if (layer === null || panel === null) return;
    const layerBounds = layer.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const [left, top] =
      state.placement === 'below'
        ? [state.rect.left - layerBounds.left + state.rect.width / 2 - panelBounds.width / 2, state.rect.bottom - layerBounds.top + GAP]
        : [state.rect.right - layerBounds.left + GAP, state.rect.top - layerBounds.top + state.rect.height / 2 - panelBounds.height / 2];
    setPosition({
      measuredFor: state,
      left: Math.max(0, Math.min(left, Math.max(0, layerBounds.width - panelBounds.width))),
      top: Math.max(0, Math.min(top, Math.max(0, layerBounds.height - panelBounds.height))),
    });
  }, [state]);

  useEffect(() => {
    if (state === null) return;
    // A dismissal is not a hover ending: the anchor scrolled, focus left, a click landed or a key
    // was pressed (decision 3). The panel goes at once, with no exit phase.
    const dismiss = () => {
      setDismissals((count) => count + 1);
      hideTooltip();
    };
    // Capture-phase scroll: a wheel inside the sidebar's own overflow-y-auto body must kill the
    // tooltip rather than leave it desynced from its anchor.
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('blur', dismiss);
    window.addEventListener('mousedown', dismiss);
    // A dialog opened from the keyboard pushes a modal overlay with no mousedown to catch it,
    // so an open reveal would otherwise float above the scrim (ADR 0120's dismissal rule).
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('blur', dismiss);
      window.removeEventListener('mousedown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [state]);

  return (
    <div ref={layerRef} role="presentation" className="pointer-events-none absolute inset-0 z-10">
      <AnimatePresence key={dismissals}>
        {state !== null && (
          <Tooltip
            key="tooltip"
            ref={panelRef}
            content={state.content}
            left={position?.left ?? 0}
            top={position?.top ?? 0}
            hidden={!positioned}
            variants={VARIANTS[state.placement]}
            {...overlayPresence}
            initial={state.warm ? false : 'hidden'}
            animate={state.warm ? SWAP_IN_PLACE : positioned ? 'visible' : 'hidden'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
