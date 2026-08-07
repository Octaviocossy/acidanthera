import { useMemo } from 'react';
import { type DispatcherCommand, type DispatcherLayer, useDispatcherLayer } from '@/lib/keymap/dispatcher';
import { useAppStore } from '@/stores/app-store';
import { useChatHistoryStore } from '@/stores/chat-history-store';
import { useKeymapStore } from '@/stores/keymap-store';

/**
 * Vim-style `j`/`k`/`l`/`Enter` navigation over the chat panel's History tab (#71). Contributes
 * the `[chat.history]` layer to the shared window dispatcher (`src/lib/keymap/dispatcher.ts`,
 * epic #94 child #97) instead of running its own independent `keydown` listener — bindings come
 * from `useKeymapStore`'s resolved `keymaps.toml`. Active only while the chat is the focused
 * region, the app is in normal mode, and the History tab is showing.
 */
export function useChatHistoryKeymap() {
  const layerBindings = useKeymapStore((state) => state.resolved.layers['chat.history']);

  const commands = useMemo<DispatcherCommand[]>(
    () => [
      { id: 'chat.history.cursor-down', chords: layerBindings.get('chat.history.cursor-down') ?? [], run: () => useChatHistoryStore.getState().moveCursor(1) },
      { id: 'chat.history.cursor-up', chords: layerBindings.get('chat.history.cursor-up') ?? [], run: () => useChatHistoryStore.getState().moveCursor(-1) },
      { id: 'chat.history.open', chords: layerBindings.get('chat.history.open') ?? [], run: () => useChatHistoryStore.getState().openCursor() },
    ],
    [layerBindings]
  );

  const layer = useMemo<DispatcherLayer>(
    () => ({
      name: 'chat.history',
      commands,
      isActive: () => {
        const app = useAppStore.getState();
        return app.activeRegion === 'chat' && app.mode === 'normal' && useChatHistoryStore.getState().tab === 'history';
      },
    }),
    [commands]
  );

  useDispatcherLayer(layer);
}
