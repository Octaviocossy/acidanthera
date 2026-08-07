import { APP_COMMANDS, type AppCommandId, type AppCommandLayer } from '@/lib/app-command';

/**
 * The layers this dispatcher resolves and merges (epic #94, child #97). `'editor'` is
 * deliberately excluded: CodeMirror owns its own keymap at top DOM precedence
 * (`src/lib/editor/region-exit.ts`), winning by event-propagation order before this dispatcher
 * ever sees a keydown, so editor commands stay out of scope for this resolver.
 */
export type KeymapLayer = Exclude<AppCommandLayer, 'editor'>;

export const KEYMAP_LAYERS: readonly KeymapLayer[] = ['global', 'sidebar', 'chat.history', 'modal'];

/**
 * The default chord(s) for every command in a {@link KEYMAP_LAYERS} layer, written exactly as
 * they'd appear in `keymaps.toml` (spec ADR 0005: command-keyed, not chord-keyed). Every command
 * in those layers has an entry here — including `[]` for one with no default chord — because
 * `seed.ts` iterates this map's keys to build the seeded catalog; a missing entry silently drops
 * a command from the seed file instead of showing it commented out.
 */
export const DEFAULT_KEYMAP: Partial<Record<AppCommandId, string[]>> = {
  // [global]
  'global.find-file': ['ctrl-w f'],
  'global.focus-next': ['ctrl-w l'],
  'global.focus-previous': ['ctrl-w h'],
  'global.toggle-sidebar': ['ctrl-w b'],
  'global.toggle-chat': ['ctrl-w c'],
  'global.toggle-settings': ['ctrl-w s'],
  'global.command-mode': [':'],

  // [sidebar]
  'sidebar.cursor-down': ['j'],
  'sidebar.cursor-up': ['k'],
  'sidebar.open': ['l', 'enter'],
  'sidebar.collapse': ['h'],
  'sidebar.new-note': ['a'],
  'sidebar.new-directory': ['shift-a'],

  // [chat.history]
  'chat.history.cursor-down': ['j'],
  'chat.history.cursor-up': ['k'],
  'chat.history.open': ['l', 'enter'],

  // [modal]
  'modal.confirm': ['enter'],
  'modal.cancel': ['escape'],
};

/** Every command id belonging to `layer`, in {@link APP_COMMANDS}' declared order. */
export function commandIdsForLayer(layer: KeymapLayer): AppCommandId[] {
  return APP_COMMANDS.filter((command) => command.layer === layer).map((command) => command.id);
}
