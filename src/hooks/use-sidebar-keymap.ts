import { useMemo } from 'react';
import { type DispatcherCommand, type DispatcherLayer, useDispatcherLayer } from '@/lib/keymap/dispatcher';
import { resolveDraftParent } from '@/lib/vault/create-entry';
import { deleteVaultEntry } from '@/lib/vault/delete-entry';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import { openVaultFile } from '@/lib/vault/open-file';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { type EntryDraftKind, useSidebarStore } from '@/stores/sidebar-store';

function visibleRows() {
  const sidebar = useSidebarStore.getState();
  return flattenVisibleTree(sidebar.tree, sidebar.expanded);
}

function moveCursor(delta: 1 | -1): void {
  const rows = visibleRows();
  if (rows.length === 0) return;
  const sidebar = useSidebarStore.getState();
  const currentIndex = rows.findIndex((row) => row.entry.path === sidebar.cursorPath);
  const nextIndex = delta === 1 ? (currentIndex === -1 ? 0 : Math.min(currentIndex + 1, rows.length - 1)) : currentIndex === -1 ? rows.length - 1 : Math.max(currentIndex - 1, 0);
  sidebar.setCursor(rows[nextIndex].entry.path);
}

function openCursorRow(): void {
  const rows = visibleRows();
  const sidebar = useSidebarStore.getState();
  const currentIndex = rows.findIndex((row) => row.entry.path === sidebar.cursorPath);
  if (currentIndex === -1) return;
  const { entry } = rows[currentIndex];

  if (entry.isDir) {
    sidebar.toggleExpanded(entry.path);
  } else {
    openVaultFile(entry.path);
  }
}

function collapseCursorRow(): void {
  const rows = visibleRows();
  const sidebar = useSidebarStore.getState();
  const currentIndex = rows.findIndex((row) => row.entry.path === sidebar.cursorPath);
  if (currentIndex === -1) return;
  const { entry } = rows[currentIndex];

  if (entry.isDir && sidebar.expanded.has(entry.path)) {
    sidebar.toggleExpanded(entry.path);
  }
}

function beginDraft(kind: EntryDraftKind): void {
  const app = useAppStore.getState();
  const sidebar = useSidebarStore.getState();

  const parentPath = resolveDraftParent(visibleRows(), sidebar.cursorPath, app.vaultRoot);
  if (parentPath === null) return;
  sidebar.beginDraft(kind, parentPath);
}

function deleteCursorRow(): void {
  const rows = visibleRows();
  const cursorPath = useSidebarStore.getState().cursorPath;
  if (cursorPath === null || !rows.some((row) => row.entry.path === cursorPath)) return;
  void deleteVaultEntry(cursorPath, rows);
}

/**
 * Vim-style `j`/`k`/`l`/`h`/`Enter` navigation over the sidebar's visible rows, plus `a`/`A` to
 * start a new note / folder (doc/v0-spec.md §3.4, §5.3). Contributes the `[sidebar]` layer to the
 * shared window dispatcher (`src/lib/keymap/dispatcher.ts`, epic #94 child #97) instead of running
 * its own independent `keydown` listener — bindings come from `useKeymapStore`'s resolved
 * `keymaps.toml`. Active only while the sidebar is the focused region and the app is in normal
 * mode; the dispatcher's own `isEditableTarget` bail is what makes this inert while a draft row's
 * input has focus.
 */
export function useSidebarKeymap() {
  const layerBindings = useKeymapStore((state) => state.resolved.layers.sidebar);

  const commands = useMemo<DispatcherCommand[]>(
    () => [
      { id: 'sidebar.cursor-down', chords: layerBindings.get('sidebar.cursor-down') ?? [], run: () => moveCursor(1) },
      { id: 'sidebar.cursor-up', chords: layerBindings.get('sidebar.cursor-up') ?? [], run: () => moveCursor(-1) },
      { id: 'sidebar.open', chords: layerBindings.get('sidebar.open') ?? [], run: openCursorRow },
      { id: 'sidebar.collapse', chords: layerBindings.get('sidebar.collapse') ?? [], run: collapseCursorRow },
      { id: 'sidebar.new-note', chords: layerBindings.get('sidebar.new-note') ?? [], run: () => beginDraft('note') },
      { id: 'sidebar.new-directory', chords: layerBindings.get('sidebar.new-directory') ?? [], run: () => beginDraft('directory') },
      { id: 'sidebar.delete', chords: layerBindings.get('sidebar.delete') ?? [], run: deleteCursorRow },
    ],
    [layerBindings]
  );

  const layer = useMemo<DispatcherLayer>(
    () => ({
      name: 'sidebar',
      commands,
      isActive: () => {
        const app = useAppStore.getState();
        return app.activeRegion === 'sidebar' && app.mode === 'normal';
      },
    }),
    [commands]
  );

  useDispatcherLayer(layer);
}
