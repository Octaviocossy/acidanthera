import { create } from 'zustand';
import type { VaultEntry } from '@/services/vault.service';

/** What a draft row will create — mirrors `vaultService.createNote` / `createDirectory` (#36). */
export type EntryDraftKind = 'note' | 'directory';

/** An in-progress vault entry: a row being named in the tree, not yet on disk (#40). */
export interface EntryDraft {
  kind: EntryDraftKind;
  /** The directory the entry lands in. Always an existing one — `create_*` never materializes a parent chain. */
  parentPath: string;
}

interface SidebarState {
  /** The vault's file tree, as last read from `vaultService.readVaultTree()`. */
  tree: VaultEntry[];
  /** Paths of directories currently expanded in the explorer. */
  expanded: Set<string>;
  /** Path of the row under the vim keyboard cursor — distinct from the open file (doc/v0-spec.md §5.3). */
  cursorPath: string | null;
  /** The pending "new note" / "new folder" row, or `null` when nothing is being named (#40). */
  draft: EntryDraft | null;

  setTree: (tree: VaultEntry[]) => void;
  toggleExpanded: (path: string) => void;
  setCursor: (path: string | null) => void;
  beginDraft: (kind: EntryDraftKind, parentPath: string) => void;
  cancelDraft: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  tree: [],
  expanded: new Set(),
  cursorPath: null,
  draft: null,

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

  beginDraft: (kind, parentPath) =>
    set((state) => ({
      draft: { kind, parentPath },
      // Unfold the target so the draft row is actually on screen. The vault root never has a row
      // of its own, so expanding it is inert.
      expanded: new Set(state.expanded).add(parentPath),
    })),

  cancelDraft: () => set({ draft: null }),
}));
