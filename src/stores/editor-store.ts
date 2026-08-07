import { create } from 'zustand';

/** The editor's own CodeMirror-vim mode — distinct from the app-level `GlobalMode` (doc/v0-spec.md §3.4). */
export type EditorVimMode = 'normal' | 'insert' | 'visual' | 'replace';

/** Where a buffer's `filePath` resolves to and how it saves — a vault note through
 *  `vaultService.writeNote`, or a config file (`settings.toml` / `keymaps.toml`) through the
 *  config commands (#100). One field answers save routing, language selection, and wikilink
 *  suppression, so no call site re-derives it from the path. */
export type EditorBufferSource = 'vault' | 'config';

export interface EditorBuffer {
  id: string;
  filePath: string;
  title: string;
  content: string;
  dirty: boolean;
  revision: number;
  savedRevision: number;
  vimMode: EditorVimMode;
  source: EditorBufferSource;
}

export interface EditorSaveRequest {
  id: number;
  bufferId: string;
  filePath: string;
  content: string;
  revision: number;
  source: EditorBufferSource;
}

let nextBufferId = 1;
let nextSaveRequestId = 1;

function fileTitle(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

/** Captures a buffer's current revision before asynchronous filesystem work begins. */
export function createEditorSaveRequest(buffer: EditorBuffer): EditorSaveRequest {
  return {
    id: nextSaveRequestId++,
    bufferId: buffer.id,
    filePath: buffer.filePath,
    content: buffer.content,
    revision: buffer.revision,
    source: buffer.source,
  };
}

export function activeEditorBuffer(state: Pick<EditorState, 'activeBufferId' | 'buffers'>): EditorBuffer | null {
  return state.buffers.find((buffer) => buffer.id === state.activeBufferId) ?? null;
}

interface EditorState {
  buffers: EditorBuffer[];
  activeBufferId: string | null;
  saveRequests: EditorSaveRequest[];

  activateBuffer: (bufferId: string) => void;
  updateBufferContent: (bufferId: string, content: string) => void;
  setBufferVimMode: (bufferId: string, mode: EditorVimMode) => void;
  requestSave: (bufferId?: string) => void;
  completeSaveRequest: (request: EditorSaveRequest) => void;
  failSaveRequest: (requestId: number) => void;
  closeBuffer: (bufferId: string) => void;
  /** Opens a file read from disk, activating an existing buffer of the same source instead of overwriting it. */
  openFile: (filePath: string, content: string, source?: EditorBufferSource) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  buffers: [],
  activeBufferId: null,
  saveRequests: [],

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
      if (buffer === undefined) return state;
      const request = createEditorSaveRequest(buffer);
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

  closeBuffer: (bufferId) =>
    set((state) => {
      const index = state.buffers.findIndex((buffer) => buffer.id === bufferId);
      if (index === -1) return state;

      const buffers = state.buffers.filter((buffer) => buffer.id !== bufferId);
      if (buffers.length === 0) return { buffers, activeBufferId: null };

      if (state.activeBufferId !== bufferId) return { buffers };
      return { buffers, activeBufferId: buffers[Math.min(index, buffers.length - 1)].id };
    }),

  openFile: (filePath, content, source = 'vault') =>
    set((state) => {
      const existing = state.buffers.find((buffer) => buffer.filePath === filePath && buffer.source === source);
      if (existing !== undefined) return { activeBufferId: existing.id };

      const fileBuffer: EditorBuffer = {
        id: `buffer-${nextBufferId++}`,
        filePath,
        title: fileTitle(filePath),
        content,
        dirty: false,
        revision: 0,
        savedRevision: 0,
        vimMode: 'normal',
        source,
      };

      return {
        activeBufferId: fileBuffer.id,
        buffers: [...state.buffers, fileBuffer],
      };
    }),
}));
