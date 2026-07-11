import { useEffect } from 'react';
import { isEditableTarget } from '@/lib/dom/is-editable-target';
import { useAppStore } from '@/stores/app-store';
import { useChatHistoryStore } from '@/stores/chat-history-store';

/**
 * Vim-style `j`/`k`/`l`/`Enter` navigation over the chat panel's History tab (#71). The exact
 * counterpart of `useSidebarKeymap`: a window-level `keydown` listener scoped to fire only while the
 * chat is the active region, the app is in normal mode, and the History tab is showing — so it never
 * steals keystrokes from the editor, the command line, or the live-chat input (`isEditableTarget`).
 *
 * - `j` / `k` — move the cursor down / up the saved-chat list.
 * - `l` / `Enter` — open the highlighted chat (loads it into the transcript, switches to the Chat tab).
 */
export function useChatHistoryKeymap() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const app = useAppStore.getState();
      if (app.activeRegion !== 'chat' || app.mode !== 'normal') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const history = useChatHistoryStore.getState();
      if (history.tab !== 'history') return;

      switch (event.key) {
        case 'j':
          event.preventDefault();
          history.moveCursor(1);
          break;
        case 'k':
          event.preventDefault();
          history.moveCursor(-1);
          break;
        case 'l':
        case 'Enter':
          event.preventDefault();
          history.openCursor();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
