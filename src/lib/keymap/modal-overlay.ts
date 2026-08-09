export interface ModalOverlay {
  /** Stable id, for debugging only — resolution is by stack position. */
  id: string;
  /** Runs on `modal.confirm`. Omit for an overlay with nothing to confirm (e.g. a menu). */
  onConfirm?: () => void;
  onCancel: () => void;
}

const overlays: ModalOverlay[] = [];

/** Registers an open overlay and returns its disposer. Safe to dispose out of order. */
export function pushModalOverlay(overlay: ModalOverlay): () => void {
  overlays.push(overlay);
  return () => {
    const index = overlays.indexOf(overlay);
    if (index !== -1) overlays.splice(index, 1);
  };
}

/** The most recently pushed still-open overlay, or `null`. */
export function topModalOverlay(): ModalOverlay | null {
  return overlays[overlays.length - 1] ?? null;
}

export function hasModalOverlay(): boolean {
  return overlays.length > 0;
}
