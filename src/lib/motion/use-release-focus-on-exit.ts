import { type RefObject, useLayoutEffect } from 'react';

/**
 * Blurs whatever holds DOM focus inside `ref` the moment its exit phase begins, so no keystroke
 * lands in an element that is only still on screen to animate out (invariant 60: "focus moved").
 * `inert` alone is not relied on, because WebKit's focus fix-up for a newly inert subtree is not
 * guaranteed and jsdom ignores it. A layout effect runs in the same commit that began the exit,
 * before the next key event.
 */
export function useReleaseFocusOnExit(ref: RefObject<HTMLElement | null>, exiting: boolean): void {
  useLayoutEffect(() => {
    if (!exiting) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && ref.current?.contains(focused)) focused.blur();
  }, [ref, exiting]);
}
