import { create } from 'zustand';

interface ContextMenuState {
  open: boolean;
  /** Viewport coordinates from the triggering event. */
  x: number;
  y: number;
  /** The right-clicked entry's path, or `null` for the empty background (= vault root). */
  target: string | null;
  show: (x: number, y: number, target: string | null) => void;
  /** Closes the menu. Leaves `x`, `y` and `target` as they were: the panel still renders them
   *  through its exit phase, so resetting them here would blank a menu that is fading out. */
  hide: () => void;
}

/** View state for the transient sidebar context-menu overlay. */
export const useContextMenuStore = create<ContextMenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  target: null,

  show: (x, y, target) => set({ open: true, x, y, target }),
  hide: () => set({ open: false }),
}));
