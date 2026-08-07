import { create } from 'zustand';
import { type ResolvedKeymap, resolveKeymap } from '@/lib/keymap/resolve';
import { useConfigStore } from './config-store';
import { useToastStore } from './toast-store';

function overridesFromParsedValue(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

interface KeymapState {
  resolved: ResolvedKeymap;
  /** Reads and resolves `keymaps.toml`, then toasts any diagnostics the merge raised. Best-effort:
   *  a missing or unreadable file leaves {@link resolved} at whatever it already was (the
   *  all-defaults keymap on first call), so every binding that works today keeps working even
   *  before the config backend has scaffolded the file. */
  load: () => Promise<void>;
}

/**
 * The resolved keymap the three dispatcher hooks (`useGlobalKeymap`, `useSidebarKeymap`,
 * `useChatHistoryKeymap`) read their bindings from (epic #94, child #97). Starts pre-resolved
 * against no override at all — the app's default bindings — so the dispatcher is correct
 * synchronously on first render, before `load()` has had a chance to run.
 */
export const useKeymapStore = create<KeymapState>((set) => ({
  resolved: resolveKeymap(null),

  load: async () => {
    try {
      await useConfigStore.getState().load('keymaps.toml');
    } catch {
      return;
    }
    const file = useConfigStore.getState().files['keymaps.toml'];
    const resolved = resolveKeymap(overridesFromParsedValue(file?.value));
    set({ resolved });
    for (const diagnostic of resolved.diagnostics) {
      useToastStore.getState().showToast(diagnostic.message, 'error');
    }
  },
}));
