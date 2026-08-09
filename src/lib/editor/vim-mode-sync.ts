import { type EditorView, ViewPlugin } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import { type EditorVimMode, useEditorStore } from '@/stores/editor-store';

function isEditorVimMode(mode: string): mode is EditorVimMode {
  return mode === 'normal' || mode === 'insert' || mode === 'visual' || mode === 'replace';
}

/** Synchronizes one mounted CodeMirror view's Vim mode to its owning editor buffer. */
export function vimModeSync(bufferId: string) {
  return ViewPlugin.fromClass(
    class {
      private readonly onModeChange = (modeInfo: { mode: string }) => {
        useEditorStore.getState().setBufferVimMode(bufferId, isEditorVimMode(modeInfo.mode) ? modeInfo.mode : 'normal');
      };
      private readonly cm: ReturnType<typeof getCM>;

      constructor(view: EditorView) {
        this.cm = getCM(view);
        this.cm?.on('vim-mode-change', this.onModeChange);
      }

      update(update: { selectionSet: boolean; state: EditorView['state'] }) {
        if (!update.selectionSet || useEditorStore.getState().activeBufferId !== bufferId) return;
        const line = update.state.doc.lineAt(update.state.selection.main.head);
        useEditorStore.getState().setCursor({ line: line.number, col: update.state.selection.main.head - line.from + 1 });
      }

      destroy() {
        this.cm?.off('vim-mode-change', this.onModeChange);
      }
    }
  );
}
