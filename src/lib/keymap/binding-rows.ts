import { APP_COMMANDS, type AppCommandId } from '@/lib/app-command';
import { type Chord, canonicalChordString, parseChord } from './chord';
import { commandIdsForLayer, DEFAULT_EDITOR_KEYMAP, DEFAULT_KEYMAP, EDITOR_COMMAND_IDS, type EditorCommandId, type KeymapLayer } from './defaults';
import { formatChord, formatChords } from './format-chord';
import type { ResolvedKeymap } from './resolve';

/** One command's line in the keymap reference. */
export interface BindingRow {
  id: AppCommandId | EditorCommandId;
  label: string;
  /** Formatted chords in binding order; empty when the command is unbound. */
  chords: string[];
  /** The default this row displaced, formatted. Absent when the row is at its default. */
  replacedDefault?: string;
}

export interface BindingSection {
  heading: string;
  rows: BindingRow[];
}

/** Section order is explicit, not {@link KEYMAP_LAYERS} order: Editor sits before Dialogs. */
const SECTIONS: readonly { heading: string; layer: KeymapLayer | 'editor' }[] = [
  { heading: 'Global', layer: 'global' },
  { heading: 'Sidebar', layer: 'sidebar' },
  { heading: 'Chat history', layer: 'chat.history' },
  { heading: 'Editor', layer: 'editor' },
  { heading: 'Dialogs', layer: 'modal' },
];

function labelFor(id: string): string {
  return APP_COMMANDS.find((command) => command.id === id)?.label ?? id;
}

/** Whether `resolved` is chord-for-chord the same binding list as the defaults it came from. */
function isDefault(resolved: Chord[], defaults: string[]): boolean {
  const a = resolved.map((chord) => canonicalChordString(chord));
  const b = defaults.map((source) => canonicalChordString(parseChord(source)));
  return a.length === b.length && a.every((chord, index) => chord === b[index]);
}

function buildRow(id: AppCommandId | EditorCommandId, bound: Chord[], defaults: string[]): BindingRow {
  const row: BindingRow = { id, label: labelFor(id), chords: formatChords(bound) };
  if (isDefault(bound, defaults)) return row;

  const replacedDefault = formatChord(defaults.map((source) => parseChord(source)));
  return replacedDefault === undefined ? row : { ...row, replacedDefault };
}

/**
 * The section/row model behind the settings dialog's **Keymaps** category. Reads
 * {@link ResolvedKeymap} and nothing else — never `APP_COMMANDS` for bindings — so the commands
 * `resolveKeymap` diagnoses as not-yet-rebindable (`editor.next-tab` and friends) are excluded by
 * construction rather than by a second list that could drift.
 */
export function buildBindingSections(resolved: ResolvedKeymap): BindingSection[] {
  return SECTIONS.map(({ heading, layer }) => ({
    heading,
    rows:
      layer === 'editor'
        ? EDITOR_COMMAND_IDS.map((id) => buildRow(id, resolved.editor[id], DEFAULT_EDITOR_KEYMAP[id]))
        : commandIdsForLayer(layer).map((id) => buildRow(id, resolved.layers[layer].get(id) ?? [], DEFAULT_KEYMAP[id] ?? [])),
  }));
}
