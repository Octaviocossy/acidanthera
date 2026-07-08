import { create } from 'zustand';

/** The editor's own CodeMirror-vim mode — distinct from the app-level `GlobalMode` (doc/v0-spec.md §3.4). */
export type EditorVimMode = 'normal' | 'insert' | 'visual' | 'replace';

const DEFAULT_CONTENT = '# Untitled\n\nStart writing — press `i` to enter insert mode.\n';

interface EditorState {
  content: string;
  dirty: boolean;
  vimMode: EditorVimMode;
  /** Bumped by `:w` / `Mod-s` inside the editor. In-memory only in this slice — #14 subscribes
   *  to actually persist to disk once the filesystem backend (#12) lands. */
  saveIntent: number;

  setContent: (content: string) => void;
  setVimMode: (mode: EditorVimMode) => void;
  requestSave: () => void;
  markSaved: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  content: DEFAULT_CONTENT,
  dirty: false,
  vimMode: 'normal',
  saveIntent: 0,

  setContent: (content) => set({ content, dirty: true }),
  setVimMode: (vimMode) => set({ vimMode }),
  requestSave: () => set((state) => ({ saveIntent: state.saveIntent + 1 })),
  markSaved: () => set({ dirty: false }),
}));
