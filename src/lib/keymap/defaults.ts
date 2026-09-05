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
  'sidebar.rename': ['r'],
  'sidebar.duplicate': ['shift-d'],
  'sidebar.delete': ['d d'],

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

/**
 * `editor.*` commands resolvable through acidanthera's own editor extensions (epic #94, child #99) —
 * kept separate from {@link KEYMAP_LAYERS}'s window-dispatcher layers because these are consumed
 * by CodeMirror's own keymap facet and `@replit/codemirror-vim`'s key-mapping API, not the shared
 * window dispatcher ({@link KeymapLayer} explicitly excludes `'editor'`). `editor.next-tab` /
 * `editor.previous-tab` / `editor.close-tab` stay out of this catalog — they're declared in
 * `AppCommandId` but not yet wired to a live dispatch of any kind.
 */
export type EditorCommandId = 'editor.save' | 'editor.system-yank';

export const EDITOR_COMMAND_IDS: readonly EditorCommandId[] = ['editor.save', 'editor.system-yank'];

/**
 * Default chord(s) for each {@link EditorCommandId}, same notation as {@link DEFAULT_KEYMAP}.
 * `editor.save` is fed directly into CodeMirror's own key-string syntax (`save.ts`);
 * `editor.system-yank` is translated into Vim key notation (`yank.ts`). The `:w` ex-command is a
 * separate, permanently registered Vim mapping (spec decision 23) and isn't part of this catalog.
 */
export const DEFAULT_EDITOR_KEYMAP: Record<EditorCommandId, string[]> = {
  'editor.save': ['mod-s'],
  'editor.system-yank': ['y'],
};
