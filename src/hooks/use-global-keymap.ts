import { useEffect, useMemo } from 'react';
import { executeAppCommand } from '@/lib/app-command';
import { type DispatcherCommand, type DispatcherLayer, useDispatcherLayer } from '@/lib/keymap/dispatcher';
import { configService } from '@/services/config.service';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';

const KEYMAPS_FILE_NAME = 'keymaps.toml';

/**
 * The app-level global vim keymap (doc/v0-spec.md §3.4). Contributes the `[global]` layer to the
 * shared window dispatcher (`src/lib/keymap/dispatcher.ts`, epic #94 child #97) — its bindings
 * come from `useKeymapStore`'s resolved `keymaps.toml`, so `Ctrl-w f` is only the *default* for
 * `global.find-file`, not a hardcoded literal. Also owns loading `keymaps.toml` on mount and
 * reloading it whenever the config-dir watcher reports it changed, since this hook mounts once at
 * the app root (`App.tsx`).
 *
 * `:` still enters command mode and `Escape` still exits it as a small standalone listener —
 * neither is a rebindable `AppCommandId` (mirroring how `:w` stays outside the command registry).
 */
export function useGlobalKeymap() {
  useEffect(() => {
    useKeymapStore
      .getState()
      .load()
      .catch(() => {});

    const unlistenPromise = configService
      .onConfigChanged((paths) => {
        if (paths.some((path) => path.endsWith(KEYMAPS_FILE_NAME))) {
          useKeymapStore
            .getState()
            .load()
            .catch(() => {});
        }
      })
      .catch(() => undefined);

    return () => {
      unlistenPromise.then((unlisten) => unlisten?.()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handleCommandModeEscape = (event: KeyboardEvent) => {
      if (useAppStore.getState().mode === 'command' && event.key === 'Escape') {
        event.preventDefault();
        useAppStore.getState().setMode('normal');
      }
    };
    window.addEventListener('keydown', handleCommandModeEscape);
    return () => window.removeEventListener('keydown', handleCommandModeEscape);
  }, []);

  const layerBindings = useKeymapStore((state) => state.resolved.layers.global);

  const commands = useMemo<DispatcherCommand[]>(
    () => [
      { id: 'global.focus-previous', chords: layerBindings.get('global.focus-previous') ?? [], run: () => useAppStore.getState().focusPrevious() },
      { id: 'global.focus-next', chords: layerBindings.get('global.focus-next') ?? [], run: () => useAppStore.getState().focusNext() },
      { id: 'global.toggle-sidebar', chords: layerBindings.get('global.toggle-sidebar') ?? [], run: () => useAppStore.getState().toggleSidebar() },
      { id: 'global.toggle-chat', chords: layerBindings.get('global.toggle-chat') ?? [], run: () => useAppStore.getState().toggleChat() },
      { id: 'global.toggle-settings', chords: layerBindings.get('global.toggle-settings') ?? [], run: () => useAppStore.getState().toggleSettings() },
      { id: 'global.find-file', chords: layerBindings.get('global.find-file') ?? [], run: () => executeAppCommand('global.find-file') },
      {
        id: 'global.command-mode',
        chords: layerBindings.get('global.command-mode') ?? [],
        run: () => {
          if (useAppStore.getState().mode === 'normal') useAppStore.getState().setMode('command');
        },
      },
    ],
    [layerBindings]
  );

  const layer = useMemo<DispatcherLayer>(() => ({ name: 'global', commands, isActive: () => true }), [commands]);

  useDispatcherLayer(layer);
}
