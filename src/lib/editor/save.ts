import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { Vim } from '@replit/codemirror-vim';
import { useEditorStore } from '@/stores/editor-store';

function requestSave(): boolean {
  useEditorStore.getState().requestSave();
  return true;
}

// Registers the `:w` ex-command on the shared Vim singleton. Module-level (runs once on
// import) since `Vim.defineEx` is process-global, not per-editor-instance.
Vim.defineEx('write', 'w', requestSave);

/** `Mod-s` mirrors `:w` outside vim normal mode (doc/v0-spec.md §5.5 keyboard-first). */
export const saveKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Mod-s',
      run: requestSave,
    },
  ])
);
