import { Compartment, type Extension } from '@codemirror/state';
import { type EditorView, ViewPlugin } from '@codemirror/view';
import type { ResolvedKeymap } from '@/lib/keymap/resolve';
import { apply as applySaveKeymap } from './save';

/**
 * Shared CM `Compartment` for the dynamic `editor.save` keymap (epic #94, child #99 step 3).
 * Reconfiguring this compartment on a keymap change swaps the live `Mod-s` binding without
 * rebuilding `EditorState` — a rebuild (e.g. by adding a keymap dependency to the `useMemo` at
 * `BufferEditor.tsx`) would destroy undo history and cursor position on every config save.
 */
export const editorKeymapCompartment = new Compartment();

/** Builds the compartment's initial content for a freshly mounted `BufferEditor`. Later changes
 *  go through {@link reconfigureEditorKeymap} instead of rebuilding this extension. */
export function editorKeymapExtension(resolved: ResolvedKeymap): Extension {
  return editorKeymapCompartment.of(applySaveKeymap(resolved));
}

const liveViews = new Set<EditorView>();

/** Registers a mounted view so {@link reconfigureEditorKeymap} can reach it, unregistering on
 *  unmount — mirrors `vimModeSync`'s `ViewPlugin.fromClass` lifecycle. */
export function trackEditorView(): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly view: EditorView;

      constructor(view: EditorView) {
        this.view = view;
        liveViews.add(view);
      }

      destroy() {
        liveViews.delete(this.view);
      }
    }
  );
}

/** Reconfigures `editor.save`'s keymap in every live editor view (epic #94, child #99 step 3). */
export function reconfigureEditorKeymap(resolved: ResolvedKeymap): void {
  const effect = editorKeymapCompartment.reconfigure(applySaveKeymap(resolved));
  for (const view of liveViews) view.dispatch({ effects: effect });
}
