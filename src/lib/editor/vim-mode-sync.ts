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

      destroy() {
        this.cm?.off('vim-mode-change', this.onModeChange);
      }
    }
  );
}
