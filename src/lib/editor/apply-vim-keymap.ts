import type { ResolvedKeymap } from '@/lib/keymap/resolve';
import { reconfigureEditorKeymap } from './keymap-compartment';
import { apply as applySystemYank } from './yank';

/**
 * Idempotently applies every rebindable editor.* binding for `resolved` (epic #94, child #99):
 * remaps `editor.system-yank`'s Vim operator and reconfigures `editor.save`'s CM keymap
 * compartment in every live editor view (which also keeps `:w` registered — see `save.ts`).
 * `BufferEditor` calls this whenever `useKeymapStore`'s resolved keymap changes, so a
 * `keymaps.toml` save reaches an already-mounted editor without rebuilding its `EditorState`.
 */
export function applyEditorKeymap(resolved: ResolvedKeymap): void {
  applySystemYank(resolved);
  reconfigureEditorKeymap(resolved);
}
