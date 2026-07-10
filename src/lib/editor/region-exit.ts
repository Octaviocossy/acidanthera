import { Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useAppStore } from '@/stores/app-store';

const CTRL_W_PREFIX_TIMEOUT_MS = 1500;

/**
 * Reserves `Ctrl-w` + `h`/`l`/`b`/`c`/`s` inside the editor at top CM precedence, mirroring
 * `useGlobalKeymap`'s chord so the same gesture works whether focus is on the editor or
 * elsewhere (doc/v0-spec.md §3.4 "CodeMirror coexistence rule": inside the editor, CodeMirror
 * is in charge). Explicitly stops propagation so the window-level global keymap — registered
 * in the bubble phase for exactly this reason — never double-handles the same keydown.
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
        const store = useAppStore.getState();

        if (awaitingCtrlW) {
          clearPrefix();
          switch (event.key) {
            case 'h':
              event.preventDefault();
              event.stopPropagation();
              store.focusPrevious();
              return true;
            case 'l':
              event.preventDefault();
              event.stopPropagation();
              store.focusNext();
              return true;
            case 'b':
              event.preventDefault();
              event.stopPropagation();
              store.toggleSidebar();
              return true;
            case 'c':
              event.preventDefault();
              event.stopPropagation();
              store.toggleChat();
              return true;
            case 's':
              event.preventDefault();
              event.stopPropagation();
              store.toggleSettings();
              return true;
            default:
              return false;
          }
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
