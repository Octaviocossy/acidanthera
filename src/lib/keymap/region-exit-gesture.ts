import { executeAppCommand } from '@/lib/app-command';
import { type ChordKey, matchesChordStep } from '@/lib/keymap/chord';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';

const CTRL_W_PREFIX_TIMEOUT_MS = 1500;

type RegionExitCommandId =
  | 'global.focus-previous'
  | 'global.focus-next'
  | 'global.toggle-sidebar'
  | 'global.toggle-chat'
  | 'global.toggle-settings'
  | 'global.find-file'
  | 'global.new-note'
  | 'global.daily-note';

/**
 * The `[global]` commands this gesture completes after arming on a Ctrl-w prefix (epic #94,
 * child #99 step 4), and the effect each runs. `global.new-note` and `global.daily-note` are here
 * because a verb promoted to the global layer must fire from *any* region.
 *
 * Both this gesture and the window dispatcher (`useGlobalKeymap`) read the very same
 * `resolved.layers.global` bindings, so rebinding one of these in `keymaps.toml` changes what it
 * does here too — there is exactly one source of truth for the gesture, not two
 * independently-hardcoded copies.
 */
const REGION_EXIT_COMMANDS: ReadonlyArray<{ id: RegionExitCommandId; run: () => void }> = [
  { id: 'global.focus-previous', run: () => useAppStore.getState().focusPrevious() },
  { id: 'global.focus-next', run: () => useAppStore.getState().focusNext() },
  { id: 'global.toggle-sidebar', run: () => useAppStore.getState().toggleSidebar() },
  { id: 'global.toggle-chat', run: () => useAppStore.getState().toggleAgent() },
  { id: 'global.toggle-settings', run: () => useAppStore.getState().toggleSettings() },
  { id: 'global.find-file', run: () => executeAppCommand('global.find-file') },
  { id: 'global.new-note', run: () => executeAppCommand('global.new-note') },
  { id: 'global.daily-note', run: () => executeAppCommand('global.daily-note') },
];

function isCtrlWPrefixStep(step: ChordKey): boolean {
  return step.key === 'w' && step.modifiers.has('ctrl') && step.modifiers.size === 1;
}

/** The completing step of every configured Ctrl-w-prefixed chord among {@link REGION_EXIT_COMMANDS},
 *  read live from the resolved keymap on every keydown — no reconfiguration needed since this
 *  closure re-reads the store on each call. A command rebound away from a Ctrl-w prefix entirely
 *  is unreachable through this gesture by construction (these are Ctrl-w region-exit gestures),
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

/** The slice of a keydown this gesture needs. Deliberately structural rather than `KeyboardEvent`,
 *  so a React synthetic event satisfies it as readily as the native one CodeMirror hands over. */
export type RegionExitKeyboardEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'> & {
  preventDefault: () => void;
  stopPropagation: () => void;
};

export interface RegionExitGesture {
  /** True when the gesture consumed the keydown — it has already called `preventDefault` and
   *  `stopPropagation` in that case, so the caller must not handle the key as well. */
  handleKeyDown: (event: RegionExitKeyboardEvent) => boolean;
  /** Disarms a half-typed prefix. Call it when the surface owning the gesture goes away, so a
   *  `Ctrl-w` typed just before unmount cannot complete against a later, unrelated keystroke. */
  reset: () => void;
}

/**
 * The `Ctrl-w`-prefix state machine that mirrors the window dispatcher's `[global]` layer for a
 * surface the dispatcher deliberately never sees a keydown from.
 *
 * `isEditableTarget` makes the dispatcher bail on any `contenteditable`, `INPUT` or `TEXTAREA`
 * target, so a surface that owns real DOM focus and owns its own keystrokes would otherwise have
 * *no* global chords at all — which is a keyboard trap wherever that focus is claimed
 * automatically rather than by a click. Two surfaces are in that position: the editor
 * (`regionExit`, a CodeMirror extension) and the *agent dock* (`HomeSurface`, a plain input that
 * takes focus whenever the viewer region is active with no buffer open). They share this one
 * implementation so the gesture cannot mean two different things depending on where focus sits.
 */
export function createRegionExitGesture(): RegionExitGesture {
  let awaitingCtrlW = false;
  let prefixTimer: ReturnType<typeof setTimeout> | null = null;

  const reset = () => {
    awaitingCtrlW = false;
    if (prefixTimer !== null) {
      clearTimeout(prefixTimer);
      prefixTimer = null;
    }
  };

  return {
    reset,
    handleKeyDown(event) {
      if (awaitingCtrlW) {
        reset();
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
        prefixTimer = setTimeout(reset, CTRL_W_PREFIX_TIMEOUT_MS);
        return true;
      }

      return false;
    },
  };
}
