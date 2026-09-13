import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { getTooltip, hideTooltip, subscribeTooltip } from '@/lib/tooltip/tooltip-overlay';

const GAP = 8;

interface Position {
  left: number;
  top: number;
}

/** Draws the hover reveal outside the scrollable explorer so it cannot be clipped (ADR 0111). */
export function TooltipHost() {
  const state = useSyncExternalStore(subscribeTooltip, getTooltip, getTooltip);
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (state === null) {
      setPosition(null);
      return;
    }
    const layer = layerRef.current;
    const panel = panelRef.current;
    if (layer === null || panel === null) return;

    const layerBounds = layer.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const left = state.rect.right - layerBounds.left + GAP;
    const top = state.rect.top - layerBounds.top + state.rect.height / 2 - panelBounds.height / 2;
    setPosition({
      left: Math.max(0, Math.min(left, Math.max(0, layerBounds.width - panelBounds.width))),
      top: Math.max(0, Math.min(top, Math.max(0, layerBounds.height - panelBounds.height))),
    });
  }, [state]);

  useEffect(() => {
    if (state === null) return;
    // Capture-phase scroll: a wheel inside the sidebar's own overflow-y-auto body must kill the
    // tooltip rather than leave it desynced from its anchor.
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('blur', hideTooltip);
    window.addEventListener('mousedown', hideTooltip);
    // A dialog opened from the keyboard pushes a modal overlay with no mousedown to catch it,
    // so an open reveal would otherwise float above the scrim (ADR 0120's dismissal rule).
    window.addEventListener('keydown', hideTooltip);
    return () => {
      window.removeEventListener('scroll', hideTooltip, true);
      window.removeEventListener('blur', hideTooltip);
      window.removeEventListener('mousedown', hideTooltip);
      window.removeEventListener('keydown', hideTooltip);
    };
  }, [state]);

  if (state === null) return null;

  return (
    <div ref={layerRef} role="presentation" className="pointer-events-none absolute inset-0 z-10">
      <Tooltip ref={panelRef} content={state.content} left={position?.left ?? 0} top={position?.top ?? 0} hidden={position === null} />
    </div>
  );
}
