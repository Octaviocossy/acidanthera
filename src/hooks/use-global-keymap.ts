import { useEffect } from 'react';
import { isEditableTarget } from '@/lib/dom/is-editable-target';
import { useAppStore } from '@/stores/app-store';

const CTRL_W_PREFIX_TIMEOUT_MS = 1500;

/**
 * The app-level global vim keymap (doc/v0-spec.md §3.4). Two prefixes:
 * - `Ctrl-w` then `h`/`l` — jump focus between regions; `c` — toggle the chat panel.
 *   Tmux/vim-style: a chord, not a modifier held with the second key.
 * - `:` — enter command mode; `Escape` — back to normal.
 * Registered on `window` in the bubble phase (not capture) so a future CodeMirror
 * instance can `stopPropagation()` to keep its own top-precedence handling authoritative
 * (the "CodeMirror coexistence rule", doc/v0-spec.md §3.4).
 */
export function useGlobalKeymap() {
  useEffect(() => {
    let awaitingCtrlW = false;
    let prefixTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPrefix = () => {
      awaitingCtrlW = false;
      if (prefixTimer !== null) {
        clearTimeout(prefixTimer);
        prefixTimer = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const store = useAppStore.getState();

      if (awaitingCtrlW) {
        clearPrefix();
        switch (event.key) {
          case 'h':
            event.preventDefault();
            store.focusPrevious();
            break;
          case 'l':
            event.preventDefault();
            store.focusNext();
            break;
          case 'c':
            event.preventDefault();
            store.toggleChat();
            break;
          default:
            break;
        }
        return;
      }

      if (event.ctrlKey && event.key === 'w' && !isEditableTarget(event.target)) {
        event.preventDefault();
        awaitingCtrlW = true;
        prefixTimer = setTimeout(clearPrefix, CTRL_W_PREFIX_TIMEOUT_MS);
        return;
      }

      if (store.mode === 'normal' && event.key === ':' && !isEditableTarget(event.target)) {
        event.preventDefault();
        store.setMode('command');
        return;
      }

      if (store.mode === 'command' && event.key === 'Escape') {
        event.preventDefault();
        store.setMode('normal');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearPrefix();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
