import { Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createRegionExitGesture } from '@/lib/keymap/region-exit-gesture';

/**
 * Reserves `Ctrl-w` + each region-exit completion key inside the editor at top CM precedence,
 * mirroring the window dispatcher's `[global]` layer so the same gesture works whether focus is on
 * the editor or elsewhere (doc/v0-spec.md §3.4 "CodeMirror coexistence rule": inside the editor,
 * CodeMirror is in charge). The gesture stops propagation itself, so the window-level global
 * keymap — registered in the bubble phase for exactly this reason — never double-handles the same
 * keydown.
 *
 * The state machine and the command table live in `createRegionExitGesture`, shared with the
 * *agent dock*, which needs the identical escape hatch for the identical reason: the dispatcher
 * bails on any target that owns its own keystrokes.
 *
 * Arms unconditionally on any `Ctrl-w`, including in vim insert mode where vim would otherwise
 * delete the previous word — unchanged from before this handler read its chords from the resolved
 * keymap; not revisited by this slice.
 */
export function regionExit() {
  const gesture = createRegionExitGesture();

  return Prec.highest(
    EditorView.domEventHandlers({
      keydown(event) {
        return gesture.handleKeyDown(event);
      },
    })
  );
}
