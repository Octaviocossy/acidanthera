import { create } from 'zustand';

/** The editor's own CodeMirror-vim mode — distinct from the app-level `GlobalMode` (doc/v0-spec.md §3.4). */
export type EditorVimMode = 'normal' | 'insert' | 'visual' | 'replace';

const DEFAULT_CONTENT = '# Untitled\n\nStart writing — press `i` to enter insert mode.\n';

interface EditorState {
  content: string;
  dirty: boolean;
  vimMode: EditorVimMode;
  /** Bumped by `:w` / `Mod-s` inside the editor. The sidebar's save loop (#14) subscribes to
   *  this to actually persist `content` to `filePath` via the filesystem backend (#12). */
  saveIntent: number;
  /** Path of the currently open note, or `null` for the unsaved scratch buffer (doc/v0-spec.md §5.3). */
  filePath: string | null;

  setContent: (content: string) => void;
  setVimMode: (mode: EditorVimMode) => void;
  requestSave: () => void;
  markSaved: () => void;
  /** Loads a note read from disk into the editor — replaces the scratch buffer, clears `dirty`. */
  openFile: (filePath: string, content: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  content: DEFAULT_CONTENT,
  dirty: false,
  vimMode: 'normal',
  saveIntent: 0,
  filePath: null,

  setContent: (content) => set({ content, dirty: true }),
  setVimMode: (vimMode) => set({ vimMode }),
  requestSave: () => set((state) => ({ saveIntent: state.saveIntent + 1 })),
  markSaved: () => set({ dirty: false }),
  openFile: (filePath, content) => set({ filePath, content, dirty: false }),
}));
