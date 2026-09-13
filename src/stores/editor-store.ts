import { create } from 'zustand';
import { EMPTY_NAVIGATION_HISTORY, type NavigationDirection, type NavigationHistory, navigateHistory, pushEntry } from '@/lib/editor/navigation-history';

/** The editor's own CodeMirror-vim mode — distinct from the app-level `GlobalMode` (doc/v0-spec.md §3.4). */
export type EditorVimMode = 'normal' | 'insert' | 'visual' | 'replace';

/** Where a buffer's `filePath` resolves to and how it saves — a vault note through
 *  `vaultService.writeNote`, or a config file (`settings.toml` / `keymaps.toml`) through the
 *  config commands (#100). One field answers save routing, language selection, and wikilink
 *  suppression, so no call site re-derives it from the path. */
export type EditorBufferSource = 'vault' | 'config';

/** Which of the two surfaces a buffer is currently shown through — the *edit view*'s CodeMirror or
 *  the rendered *read view*. A field on the buffer exactly as `vimMode` is, so two open notes can
 *  sit in different views (spec decision 1), and **session-only**: nothing persists it. Only a
 *  `source: 'vault'` buffer has a meaningful one — a config buffer is forced to `'edit'`, since
 *  TOML has nothing to render (decision 2). */
export type BufferView = 'edit' | 'read';

export interface EditorBuffer {
  id: string;
  filePath: string;
  title: string;
  content: string;
  dirty: boolean;
  revision: number;
  savedRevision: number;
  vimMode: EditorVimMode;
  view: BufferView;
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

export interface EditorCursor {
  line: number;
  col: number;
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

/**
 * Steps the *navigation history* and activates the buffer it lands on, in one atomic update.
 *
 * It deliberately does not go through `activateBuffer`, which pushes — moving through the stack
 * must not rewrite it.
 */
function stepHistory(state: EditorState, direction: NavigationDirection): Partial<EditorState> {
  const isOpen = (path: string) => state.buffers.some((buffer) => buffer.filePath === path);
  const { history, path } = navigateHistory(state.history, direction, isOpen);
  const buffer = path === null ? undefined : state.buffers.find((candidate) => candidate.filePath === path);

  // The pruned history still applies when nothing was found, so the controls settle to disabled.
  return buffer === undefined ? { history } : { history, activeBufferId: buffer.id };
}

interface EditorState {
  buffers: EditorBuffer[];
  activeBufferId: string | null;
  cursor: EditorCursor;
  saveRequests: EditorSaveRequest[];
  /** Back/forward over buffer activations, keyed by file path (ADR 0123). A renamed buffer's old
   *  entry simply goes stale and is pruned on the next walk past it. */
  history: NavigationHistory;

  activateBuffer: (bufferId: string) => void;
  /** Activates the previous entry in the *navigation history*, skipping any closed since. */
  goBack: () => void;
  /** Activates the next entry in the *navigation history*, skipping any closed since. */
  goForward: () => void;
  /** Empties the stack — every entry of a switched-away vault points where nothing is open. */
  clearHistory: () => void;
  updateBufferContent: (bufferId: string, content: string) => void;
  setCursor: (cursor: EditorCursor) => void;
  setBufferVimMode: (bufferId: string, mode: EditorVimMode) => void;
  /** Sets one buffer's *buffer view*. A no-op on a config buffer, which has none (spec decision 2)
   *  — the same applicability rule `openFile` and `toggleActiveBufferView` already enforce. */
  setBufferView: (bufferId: string, view: BufferView) => void;
  /** Flips the active buffer's *buffer view*. A no-op with no buffer open, and on a config buffer,
   *  which has no read view to flip into — the same applicability rule that hides the *view
   *  toggle* there (spec decision 2). */
  toggleActiveBufferView: () => void;
  requestSave: (bufferId?: string) => void;
  completeSaveRequest: (request: EditorSaveRequest) => void;
  failSaveRequest: (requestId: number) => void;
  closeBuffer: (bufferId: string) => void;
  /** Closes vault buffers at `path` or below it, leaving config buffers and prefix-named siblings intact. */
  closeBuffersUnder: (path: string) => void;
  /** Moves vault buffers at `oldPath` or below it to their renamed paths without changing their editing state. */
  rewriteBufferPaths: (oldPath: string, newPath: string) => void;
  /** Replaces a clean vault buffer's content after an external wikilink rewrite. */
  reloadCleanBuffer: (filePath: string, content: string) => void;
  /** Opens a file read from disk, activating an existing buffer of the same source instead of
   *  overwriting it. `view` defaults to `'read'` for a vault note (spec decision 3) and is forced
   *  to `'edit'` for a config buffer; a caller passes `'edit'` for a note it just created
   *  (decision 4). The dedupe branch ignores it — an already-open buffer keeps the view it had. */
  openFile: (filePath: string, content: string, source?: EditorBufferSource, view?: BufferView) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  buffers: [],
  activeBufferId: null,
  cursor: { line: 1, col: 1 },
  saveRequests: [],
  history: EMPTY_NAVIGATION_HISTORY,

  activateBuffer: (bufferId) =>
    set((state) => {
      const buffer = state.buffers.find((candidate) => candidate.id === bufferId);
      if (buffer === undefined) return state;
      return { activeBufferId: bufferId, history: pushEntry(state.history, buffer.filePath) };
    }),

  goBack: () => set((state) => stepHistory(state, 'back')),

  goForward: () => set((state) => stepHistory(state, 'forward')),

  clearHistory: () => set({ history: EMPTY_NAVIGATION_HISTORY }),

  updateBufferContent: (bufferId, content) =>
    set((state) => ({
      buffers: state.buffers.map((buffer) => (buffer.id === bufferId ? { ...buffer, content, revision: buffer.revision + 1, dirty: true } : buffer)),
    })),

  setCursor: (cursor) => set({ cursor }),

  setBufferVimMode: (bufferId, vimMode) =>
    set((state) => ({
      buffers: state.buffers.map((buffer) => (buffer.id === bufferId ? { ...buffer, vimMode } : buffer)),
    })),

  setBufferView: (bufferId, view) =>
    set((state) => {
      const buffer = state.buffers.find((candidate) => candidate.id === bufferId);
      // A config buffer has no *buffer view* to set (decision 2), so the write is dropped rather
      // than coerced to `'edit'`: a silent write is worse than no write. No caller can reach this
      // today — `ViewToggle` draws nothing for config — but the rule is enforced in `openFile` and
      // `toggleActiveBufferView` already, and an invariant held in two of three places is not held.
      if (buffer === undefined || buffer.source === 'config') return state;
      return {
        buffers: state.buffers.map((candidate) => (candidate.id === bufferId ? { ...candidate, view } : candidate)),
      };
    }),

  toggleActiveBufferView: () =>
    set((state) => {
      const buffer = activeEditorBuffer(state);
      if (buffer === null || buffer.source === 'config') return state;
      return {
        buffers: state.buffers.map((candidate) => (candidate.id === buffer.id ? { ...candidate, view: candidate.view === 'read' ? 'edit' : 'read' } : candidate)),
      };
    }),

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

  closeBuffersUnder: (path) =>
    set((state) => {
      const normalizedPath = path.replace(/[\\/]+$/, '');
      const bufferIds = state.buffers
        .filter(
          (buffer) =>
            buffer.source === 'vault' &&
            (buffer.filePath === normalizedPath || buffer.filePath.startsWith(`${normalizedPath}/`) || buffer.filePath.startsWith(`${normalizedPath}\\`))
        )
        .map((buffer) => buffer.id);

      let buffers = state.buffers;
      let activeBufferId = state.activeBufferId;
      for (const bufferId of bufferIds) {
        const index = buffers.findIndex((buffer) => buffer.id === bufferId);
        if (index === -1) continue;
        buffers = buffers.filter((buffer) => buffer.id !== bufferId);
        if (activeBufferId === bufferId) activeBufferId = buffers.length === 0 ? null : buffers[Math.min(index, buffers.length - 1)].id;
      }
      return { buffers, activeBufferId };
    }),

  rewriteBufferPaths: (oldPath, newPath) =>
    set((state) => {
      const normalizedOldPath = oldPath.replace(/[\\/]+$/, '');
      const normalizedNewPath = newPath.replace(/[\\/]+$/, '');
      return {
        buffers: state.buffers.map((buffer) => {
          if (buffer.source !== 'vault') return buffer;
          if (buffer.filePath === normalizedOldPath) return { ...buffer, filePath: normalizedNewPath, title: fileTitle(normalizedNewPath) };
          if (!buffer.filePath.startsWith(`${normalizedOldPath}/`) && !buffer.filePath.startsWith(`${normalizedOldPath}\\`)) return buffer;

          const filePath = `${normalizedNewPath}${buffer.filePath.slice(normalizedOldPath.length)}`;
          return { ...buffer, filePath, title: fileTitle(filePath) };
        }),
      };
    }),

  reloadCleanBuffer: (filePath, content) =>
    set((state) => ({
      buffers: state.buffers.map((buffer) => (buffer.source === 'vault' && buffer.filePath === filePath && !buffer.dirty ? { ...buffer, content } : buffer)),
    })),

  openFile: (filePath, content, source = 'vault', view) =>
    set((state) => {
      const existing = state.buffers.find((buffer) => buffer.filePath === filePath && buffer.source === source);
      if (existing !== undefined) return { activeBufferId: existing.id, history: pushEntry(state.history, existing.filePath) };

      const fileBuffer: EditorBuffer = {
        id: `buffer-${nextBufferId++}`,
        filePath,
        title: fileTitle(filePath),
        content,
        dirty: false,
        revision: 0,
        savedRevision: 0,
        vimMode: 'normal',
        // A config buffer has no read view at all, so the requested one is not merely ignored here
        // — it cannot exist. A vault note falls back to `'read'`, the default a note opens into.
        view: source === 'config' ? 'edit' : (view ?? 'read'),
        source,
      };

      return {
        activeBufferId: fileBuffer.id,
        buffers: [...state.buffers, fileBuffer],
        history: pushEntry(state.history, filePath),
      };
    }),
}));
