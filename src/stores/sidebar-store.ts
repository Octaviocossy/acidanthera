import { create } from 'zustand';
import type { VaultEntry } from '@/services/vault.service';

interface SidebarState {
  /** The vault's file tree, as last read from `vaultService.readVaultTree()`. */
  tree: VaultEntry[];
  /** Paths of directories currently expanded in the explorer. */
  expanded: Set<string>;
  /** Path of the row under the vim keyboard cursor — distinct from the open file (doc/v0-spec.md §5.3). */
  cursorPath: string | null;

  setTree: (tree: VaultEntry[]) => void;
  toggleExpanded: (path: string) => void;
  setCursor: (path: string | null) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  tree: [],
  expanded: new Set(),
  cursorPath: null,

  setTree: (tree) => set({ tree }),

  toggleExpanded: (path) =>
    set((state) => {
      const expanded = new Set(state.expanded);
      if (expanded.has(path)) {
        expanded.delete(path);
      } else {
        expanded.add(path);
      }
      return { expanded };
    }),

  setCursor: (cursorPath) => set({ cursorPath }),
}));
