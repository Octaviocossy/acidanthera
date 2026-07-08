import { type EditorView, ViewPlugin } from '@codemirror/view';
import { getCM } from '@replit/codemirror-vim';
import { type EditorVimMode, useEditorStore } from '@/stores/editor-store';

function isEditorVimMode(mode: string): mode is EditorVimMode {
  return mode === 'normal' || mode === 'insert' || mode === 'visual' || mode === 'replace';
}

/**
 * Feeds `@replit/codemirror-vim`'s `vim-mode-change` event (its CodeMirror-5-style event
 * bus, accessed via `getCM(view)`) into `editor-store` so a mode indicator can render outside
 * CodeMirror itself (doc/v0-spec.md §5.1).
 */
export const vimModeSync = ViewPlugin.fromClass(
  class {
    private readonly onModeChange = (modeInfo: { mode: string }) => {
      useEditorStore.getState().setVimMode(isEditorVimMode(modeInfo.mode) ? modeInfo.mode : 'normal');
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
