import type { AppCommandId } from '@/lib/app-command';
import { commandIdsForLayer, DEFAULT_KEYMAP, KEYMAP_LAYERS, type KeymapLayer } from './defaults';

function tomlStringArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function formatBinding(commandId: AppCommandId, keyColumnWidth: number): string {
  const chords = DEFAULT_KEYMAP[commandId] ?? [];
  const key = `${JSON.stringify(commandId)}`.padEnd(keyColumnWidth);
  const value = tomlStringArray(chords);
  const suffix = chords.length === 0 ? '   # no default chord' : '';
  return `# ${key} = ${value}${suffix}`;
}

function formatLayerSection(layer: KeymapLayer): string {
  const commandIds = commandIdsForLayer(layer);
  const keyColumnWidth = Math.max(...commandIds.map((commandId) => JSON.stringify(commandId).length));
  const lines = commandIds.map((commandId) => formatBinding(commandId, keyColumnWidth));
  return [`# [${layer}] — every command, with its default chords.`, '# Uncomment a line and edit it to change it.', '#', ...lines].join('\n');
}

const HEADER = [
  '# acidanthera keymaps',
  '#',
  "# Every line below is commented out and shows that command's current default. Uncomment a",
  '# line and edit its chord array to rebind it — a chord array is always replaced wholesale,',
  "# never merged with the default. Set a command's array to [] to unbind it entirely.",
  '#',
  "# `:w` (save) is not rebindable here — it's owned by the editor slice, not this catalog.",
].join('\n');

/**
 * Generates the self-documenting `keymaps.toml` seed (epic #94, child #97 step 6): every
 * resolvable command, commented out, grouped by layer, showing its current default so
 * uncommenting a line and editing its chord array is the entire rebinding UX (spec ADR 0005:
 * command-keyed, not chord-keyed). Mirrored by `DEFAULT_KEYMAPS_TOML` in
 * `src-tauri/src/config.rs`'s first-run scaffold — keep the two in sync.
 */
export function generateKeymapsToml(): string {
  const sections = KEYMAP_LAYERS.map((layer) => formatLayerSection(layer));
  return `${HEADER}\n\n${sections.join('\n\n')}\n`;
}
