import { Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { executeAppCommand } from '@/lib/app-command';
import { type ChordKey, matchesChordStep } from '@/lib/keymap/chord';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';

const CTRL_W_PREFIX_TIMEOUT_MS = 1500;

type RegionExitCommandId = 'global.focus-previous' | 'global.focus-next' | 'global.toggle-sidebar' | 'global.toggle-chat' | 'global.toggle-settings' | 'global.find-file';

/**
 * The six `[global]` commands this handler completes after arming on a Ctrl-w prefix (epic #94,
 * child #99 step 4), and the effect each runs. Both this handler and the window dispatcher
 * (`useGlobalKeymap`) read the very same `resolved.layers.global` bindings, so rebinding one of
 * these in `keymaps.toml` changes what it does here too — there is exactly one source of truth
 * for the gesture, not two independently-hardcoded copies.
 */
const REGION_EXIT_COMMANDS: ReadonlyArray<{ id: RegionExitCommandId; run: () => void }> = [
  { id: 'global.focus-previous', run: () => useAppStore.getState().focusPrevious() },
  { id: 'global.focus-next', run: () => useAppStore.getState().focusNext() },
  { id: 'global.toggle-sidebar', run: () => useAppStore.getState().toggleSidebar() },
  { id: 'global.toggle-chat', run: () => useAppStore.getState().toggleChat() },
  { id: 'global.toggle-settings', run: () => useAppStore.getState().toggleSettings() },
  { id: 'global.find-file', run: () => executeAppCommand('global.find-file') },
];

function isCtrlWPrefixStep(step: ChordKey): boolean {
  return step.key === 'w' && step.modifiers.has('ctrl') && step.modifiers.size === 1;
}

/** The completing step of every configured Ctrl-w-prefixed chord among {@link REGION_EXIT_COMMANDS},
 *  read live from the resolved keymap on every keydown — no reconfiguration needed since this
 *  closure re-reads the store on each call. A command rebound away from a Ctrl-w prefix entirely
 *  is unreachable from inside the editor by construction (these are Ctrl-w region-exit gestures),
 *  but still works everywhere else via the window dispatcher. */
function completionSteps(): Array<{ step: ChordKey; run: () => void }> {
  const global = useKeymapStore.getState().resolved.layers.global;
  const steps: Array<{ step: ChordKey; run: () => void }> = [];
  for (const { id, run } of REGION_EXIT_COMMANDS) {
    for (const chord of global.get(id) ?? []) {
      if (chord.length === 2 && isCtrlWPrefixStep(chord[0])) {
        steps.push({ step: chord[1], run });
      }
    }
  }
  return steps;
}

/**
 * Reserves `Ctrl-w` + each {@link REGION_EXIT_COMMANDS} completion key inside the editor at top CM
 * precedence, mirroring the window dispatcher's `[global]` layer so the same gesture works
 * whether focus is on the editor or elsewhere (doc/v0-spec.md §3.4 "CodeMirror coexistence rule":
 * inside the editor, CodeMirror is in charge). Explicitly stops propagation so the window-level
 * global keymap — registered in the bubble phase for exactly this reason — never double-handles
 * the same keydown.
 *
 * Arms unconditionally on any `Ctrl-w`, including in vim insert mode where vim would otherwise
 * delete the previous word — unchanged from before this handler read its chords from the resolved
 * keymap; not revisited by this slice.
 */
export function regionExit() {
  let awaitingCtrlW = false;
  let prefixTimer: ReturnType<typeof setTimeout> | null = null;

  const clearPrefix = () => {
    awaitingCtrlW = false;
    if (prefixTimer !== null) {
      clearTimeout(prefixTimer);
      prefixTimer = null;
    }
  };

  return Prec.highest(
    EditorView.domEventHandlers({
      keydown(event) {
        if (awaitingCtrlW) {
          clearPrefix();
          for (const { step, run } of completionSteps()) {
            if (matchesChordStep(step, event)) {
              event.preventDefault();
              event.stopPropagation();
              run();
              return true;
            }
          }
          return false;
        }

        if (event.ctrlKey && event.key === 'w') {
          event.preventDefault();
          event.stopPropagation();
          awaitingCtrlW = true;
          prefixTimer = setTimeout(clearPrefix, CTRL_W_PREFIX_TIMEOUT_MS);
          return true;
        }

        return false;
      },
    })
  );
}
