/**
 * The read view's live scroll container, exposed to `useViewerKeymap` without a DOM query — a
 * module-scope binding mirroring `tooltip-overlay.ts`'s shape. `BufferPane` mounts one `ReadView`
 * per open buffer simultaneously, hiding every one but the active buffer's (`Viewer.tsx`), so this
 * holds whichever container is currently active, showing, and in `view: 'read'` — `ReadView`
 * registers on that condition and clears it again on the same condition going false or on unmount.
 */
let container: HTMLElement | null = null;

export function registerViewerScrollContainer(next: HTMLElement): void {
  container = next;
}

/** No-ops unless `current` is still the registered container — guards against a newer `ReadView`
 *  instance's registration being clobbered by an older one's unmount running after it. */
export function unregisterViewerScrollContainer(current: HTMLElement): void {
  if (container === current) container = null;
}

export function getViewerScrollContainer(): HTMLElement | null {
  return container;
}
