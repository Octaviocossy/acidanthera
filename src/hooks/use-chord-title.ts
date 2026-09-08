import { useMemo } from 'react';
import { APP_COMMANDS, type AppCommandId } from '@/lib/app-command';
import { EDITOR_COMMAND_IDS, type EditorCommandId } from '@/lib/keymap/defaults';
import { formatChord } from '@/lib/keymap/format-chord';
import { useKeymapStore } from '@/stores/keymap-store';

/**
 * The first chord currently bound to `commandId`, formatted — or `undefined` when the command is
 * unbound or isn't rebindable at all (`editor.next-tab` and friends never reach `ResolvedKeymap`).
 *
 * A **hook, not a plain function** (invariant 31): `useConfigWatcher` live-reloads `keymaps.toml`,
 * so a helper reading `useKeymapStore.getState()` during render would never re-render on a rebind —
 * reintroducing the exact staleness this replaces, one level deeper.
 */
export function useCommandChord(commandId: AppCommandId): string | undefined {
  const resolved = useKeymapStore((state) => state.resolved);

  return useMemo(() => {
    const layer = APP_COMMANDS.find((command) => command.id === commandId)?.layer;
    if (layer === undefined) return undefined;
    if (layer === 'editor') {
      return EDITOR_COMMAND_IDS.includes(commandId as EditorCommandId) ? formatChord(resolved.editor[commandId as EditorCommandId]) : undefined;
    }
    return formatChord(resolved.layers[layer].get(commandId));
  }, [resolved, commandId]);
}

/** `"Find file (Ctrl+wf)"` — the native `title` a chrome control carries, or the bare label when
 *  the command is unbound. */
export function useChordTitle(label: string, commandId: AppCommandId): string {
  const chord = useCommandChord(commandId);
  return chord === undefined ? label : `${label} (${chord})`;
}
