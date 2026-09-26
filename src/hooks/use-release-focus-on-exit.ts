import { type RefObject, useLayoutEffect } from 'react';

/**
 * Moves DOM focus off `ref`'s subtree on the commit that begins its *exit phase* (invariant 60),
 * so nothing typed lands in an element that is only still on screen to animate out. `inert` alone
 * is not relied on: jsdom has no focus fixup for it, and a layout effect makes the release land in
 * the same commit as the close. Focus goes to `document.body` — exactly where an unmount used to
 * leave it — and whoever claims it next (`requestEditorFocus`, a region's focus effect) claims it
 * from there. Only focus *inside* the subtree is blurred: focus that already moved elsewhere is
 * left alone.
 */
export function useReleaseFocusOnExit(ref: RefObject<HTMLElement | null>, exiting: boolean): void {
  useLayoutEffect(() => {
    if (!exiting) return;
    const node = ref.current;
    const focused = document.activeElement;
    if (node !== null && focused instanceof HTMLElement && node.contains(focused)) focused.blur();
  }, [ref, exiting]);
}
