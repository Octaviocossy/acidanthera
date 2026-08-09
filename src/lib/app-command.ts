import { useFileFinderStore } from '@/stores/file-finder-store';

/** Which input layer an {@link AppCommandId} belongs to — the namespace before its dotted id
 *  (`chat.history.*` stays one layer, matching its two-segment id prefix). */
export type AppCommandLayer = 'global' | 'sidebar' | 'chat.history' | 'editor' | 'modal';

/**
 * Every action dispatched outside a focused text input, as a fully-qualified dotted id (spec
 * decision 18): an id in a toast or error message is unambiguous without its section. Per spec
 * decision 14, in-input handlers (ChatInput submit, FileFinder accept, EntryDraftRow commit,
 * CommandBar) are deliberately excluded — they own their own keydown handling.
 */
export type AppCommandId =
  | 'global.find-file'
  | 'global.focus-next'
  | 'global.focus-previous'
  | 'global.toggle-sidebar'
  | 'global.toggle-chat'
  | 'global.toggle-settings'
  | 'global.command-mode'
  | 'sidebar.cursor-down'
  | 'sidebar.cursor-up'
  | 'sidebar.open'
  | 'sidebar.collapse'
  | 'sidebar.new-note'
  | 'sidebar.new-directory'
  | 'sidebar.delete'
  | 'chat.history.cursor-down'
  | 'chat.history.cursor-up'
  | 'chat.history.open'
  | 'editor.save'
  | 'editor.system-yank'
  | 'editor.next-tab'
  | 'editor.previous-tab'
  | 'editor.close-tab'
  | 'modal.confirm'
  | 'modal.cancel';

/** One registry entry: an id, its human label (for a future rebinding UI), and its layer. */
export interface AppCommandDescriptor {
  id: AppCommandId;
  label: string;
  layer: AppCommandLayer;
}

/**
 * The full command registry (spec decision 18). This is the catalog a keymap-conflict check and a
 * future rebinding UI read from — it does not imply every id is dispatched through
 * {@link executeAppCommand} yet; most are still invoked directly against their owning store from
 * inside each layer's own keydown handler, unchanged by this slice.
 */
export const APP_COMMANDS: readonly AppCommandDescriptor[] = [
  { id: 'global.find-file', label: 'Find file', layer: 'global' },
  { id: 'global.focus-next', label: 'Focus next region', layer: 'global' },
  { id: 'global.focus-previous', label: 'Focus previous region', layer: 'global' },
  { id: 'global.toggle-sidebar', label: 'Toggle sidebar', layer: 'global' },
  { id: 'global.toggle-chat', label: 'Toggle chat', layer: 'global' },
  { id: 'global.toggle-settings', label: 'Toggle settings', layer: 'global' },
  { id: 'global.command-mode', label: 'Enter command mode', layer: 'global' },
  { id: 'sidebar.cursor-down', label: 'Move cursor down', layer: 'sidebar' },
  { id: 'sidebar.cursor-up', label: 'Move cursor up', layer: 'sidebar' },
  { id: 'sidebar.open', label: 'Open entry', layer: 'sidebar' },
  { id: 'sidebar.collapse', label: 'Collapse directory', layer: 'sidebar' },
  { id: 'sidebar.new-note', label: 'New note', layer: 'sidebar' },
  { id: 'sidebar.new-directory', label: 'New directory', layer: 'sidebar' },
  { id: 'sidebar.delete', label: 'Delete entry', layer: 'sidebar' },
  { id: 'chat.history.cursor-down', label: 'Move cursor down', layer: 'chat.history' },
  { id: 'chat.history.cursor-up', label: 'Move cursor up', layer: 'chat.history' },
  { id: 'chat.history.open', label: 'Open chat', layer: 'chat.history' },
  { id: 'editor.save', label: 'Save note', layer: 'editor' },
  { id: 'editor.system-yank', label: 'System clipboard yank', layer: 'editor' },
  { id: 'editor.next-tab', label: 'Next tab', layer: 'editor' },
  { id: 'editor.previous-tab', label: 'Previous tab', layer: 'editor' },
  { id: 'editor.close-tab', label: 'Close tab', layer: 'editor' },
  { id: 'modal.confirm', label: 'Confirm', layer: 'modal' },
  { id: 'modal.cancel', label: 'Cancel', layer: 'modal' },
];

/** Executes app actions that are shared by multiple input layers. */
export function executeAppCommand(command: AppCommandId): void {
  switch (command) {
    case 'global.find-file':
      useFileFinderStore.getState().show();
      break;
    default:
      break;
  }
}
