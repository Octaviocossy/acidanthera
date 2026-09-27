import { create } from 'zustand';

interface FileFinderState {
  open: boolean;
  query: string;
  cursor: number;
  show: () => void;
  hide: () => void;
  setQuery: (query: string) => void;
  moveCursor: (delta: number, count: number) => void;
}

/** View state for the transient vault file finder overlay. */
export const useFileFinderStore = create<FileFinderState>((set) => ({
  open: false,
  query: '',
  cursor: 0,

  show: () => set({ open: true, query: '', cursor: 0 }),
  /** Closes the finder. `query` and `cursor` are deliberately kept — `show` resets both — so the
   *  finder leaving during its *exit phase* still shows what was typed rather than the full list. */
  hide: () => set({ open: false }),
  setQuery: (query) => set({ query, cursor: 0 }),
  moveCursor: (delta, count) =>
    set((state) => ({
      cursor: count === 0 ? 0 : Math.max(0, Math.min(state.cursor + delta, count - 1)),
    })),
}));
