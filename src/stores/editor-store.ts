import { create } from 'zustand';

/** The editor's own CodeMirror-vim mode — distinct from the app-level `GlobalMode` (doc/v0-spec.md §3.4). */
export type EditorVimMode = 'normal' | 'insert' | 'visual' | 'replace';

export interface EditorBuffer {
  id: string;
  filePath: string | null;
  title: string;
  content: string;
  dirty: boolean;
  revision: number;
  savedRevision: number;
  vimMode: EditorVimMode;
}

export interface EditorSaveRequest {
  id: number;
  bufferId: string;
  filePath: string;
  content: string;
  revision: number;
}

const DEFAULT_CONTENT = '# Untitled\n\nStart writing — press `i` to enter insert mode.\n';

let nextBufferId = 1;
let nextSaveRequestId = 1;

function createScratchBuffer(): EditorBuffer {
  const id = `scratch-${nextBufferId++}`;
  return {
    id,
    filePath: null,
    title: 'Untitled',
    content: DEFAULT_CONTENT,
    dirty: false,
    revision: 0,
    savedRevision: 0,
    vimMode: 'normal',
  };
}

function fileTitle(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export function activeEditorBuffer(state: Pick<EditorState, 'activeBufferId' | 'buffers'>): EditorBuffer {
  return state.buffers.find((buffer) => buffer.id === state.activeBufferId) ?? state.buffers[0];
}

interface EditorState {
  buffers: EditorBuffer[];
  activeBufferId: string;
  saveRequests: EditorSaveRequest[];

  createScratchBuffer: () => void;
  activateBuffer: (bufferId: string) => void;
  updateBufferContent: (bufferId: string, content: string) => void;
  setBufferVimMode: (bufferId: string, mode: EditorVimMode) => void;
  requestSave: (bufferId?: string) => void;
  completeSaveRequest: (request: EditorSaveRequest) => void;
  failSaveRequest: (requestId: number) => void;
  /** Opens a note read from disk, activating an existing buffer instead of overwriting it. */
  openFile: (filePath: string, content: string) => void;
}

const initialBuffer = createScratchBuffer();

export const useEditorStore = create<EditorState>((set) => ({
  buffers: [initialBuffer],
  activeBufferId: initialBuffer.id,
  saveRequests: [],

  createScratchBuffer: () => {
    const buffer = createScratchBuffer();
    set((state) => ({ buffers: [...state.buffers, buffer], activeBufferId: buffer.id }));
  },

  activateBuffer: (bufferId) => set((state) => (state.buffers.some((buffer) => buffer.id === bufferId) ? { activeBufferId: bufferId } : state)),

  updateBufferContent: (bufferId, content) =>
    set((state) => ({
      buffers: state.buffers.map((buffer) => (buffer.id === bufferId ? { ...buffer, content, revision: buffer.revision + 1, dirty: true } : buffer)),
    })),

  setBufferVimMode: (bufferId, vimMode) =>
    set((state) => ({
      buffers: state.buffers.map((buffer) => (buffer.id === bufferId ? { ...buffer, vimMode } : buffer)),
    })),

  requestSave: (bufferId) =>
    set((state) => {
      const buffer = state.buffers.find((candidate) => candidate.id === (bufferId ?? state.activeBufferId));
      if (buffer === undefined || buffer.filePath === null) return state;

      const request: EditorSaveRequest = {
        id: nextSaveRequestId++,
        bufferId: buffer.id,
        filePath: buffer.filePath,
        content: buffer.content,
        revision: buffer.revision,
      };
      return { saveRequests: [...state.saveRequests, request] };
    }),

  completeSaveRequest: (request) =>
    set((state) => ({
      saveRequests: state.saveRequests.filter((candidate) => candidate.id !== request.id),
      buffers: state.buffers.map((buffer) => {
        if (buffer.id !== request.bufferId) return buffer;
        const savedRevision = Math.max(buffer.savedRevision, request.revision);
        return { ...buffer, savedRevision, dirty: buffer.revision !== savedRevision };
      }),
    })),

  failSaveRequest: (requestId) => set((state) => ({ saveRequests: state.saveRequests.filter((request) => request.id !== requestId) })),

  openFile: (filePath, content) =>
    set((state) => {
      const existing = state.buffers.find((buffer) => buffer.filePath === filePath);
      if (existing !== undefined) return { activeBufferId: existing.id };

      const activeBuffer = activeEditorBuffer(state);
      const fileBuffer: EditorBuffer = {
        id: activeBuffer.filePath === null && !activeBuffer.dirty ? activeBuffer.id : `buffer-${nextBufferId++}`,
        filePath,
        title: fileTitle(filePath),
        content,
        dirty: false,
        revision: 0,
        savedRevision: 0,
        vimMode: 'normal',
      };

      return {
        activeBufferId: fileBuffer.id,
        buffers: fileBuffer.id === activeBuffer.id ? state.buffers.map((buffer) => (buffer.id === activeBuffer.id ? fileBuffer : buffer)) : [...state.buffers, fileBuffer],
      };
    }),
}));
