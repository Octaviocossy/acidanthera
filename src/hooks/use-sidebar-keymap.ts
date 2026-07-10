import { useEffect } from 'react';
import { isEditableTarget } from '@/lib/dom/is-editable-target';
import { resolveDraftParent } from '@/lib/vault/create-entry';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import { openVaultFile } from '@/lib/vault/open-file';
import { useAppStore } from '@/stores/app-store';
import { useSidebarStore } from '@/stores/sidebar-store';

/**
 * Vim-style `j`/`k`/`l`/`h`/`Enter` navigation over the sidebar's visible rows, plus `a`/`A` to
 * start a new note / folder (doc/v0-spec.md §3.4, §5.3). Scoped to fire only while the sidebar is
 * the active region and the app is in normal mode, mirroring how `useGlobalKeymap` scopes its own
 * chords — so it never steals keystrokes meant for the editor or the command line. The
 * `isEditableTarget` guard is also what makes `a` inert while a draft row's input has focus.
 */
export function useSidebarKeymap() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const app = useAppStore.getState();
      if (app.activeRegion !== 'sidebar' || app.mode !== 'normal') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const sidebar = useSidebarStore.getState();
      const rows = flattenVisibleTree(sidebar.tree, sidebar.expanded);

      // Handled before the empty-tree bail-out below: a vault with no rows is exactly when the
      // first note has to be creatable.
      if (event.key === 'a' || event.key === 'A') {
        const parentPath = resolveDraftParent(rows, sidebar.cursorPath, app.vaultRoot);
        if (parentPath === null) return;
        event.preventDefault();
        sidebar.beginDraft(event.key === 'a' ? 'note' : 'directory', parentPath);
        return;
      }

      if (rows.length === 0) return;

      const currentIndex = rows.findIndex((row) => row.entry.path === sidebar.cursorPath);

      switch (event.key) {
        case 'j': {
          event.preventDefault();
          const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, rows.length - 1);
          sidebar.setCursor(rows[nextIndex].entry.path);
          break;
        }
        case 'k': {
          event.preventDefault();
          const nextIndex = currentIndex === -1 ? rows.length - 1 : Math.max(currentIndex - 1, 0);
          sidebar.setCursor(rows[nextIndex].entry.path);
          break;
        }
        case 'l':
        case 'Enter': {
          if (currentIndex === -1) break;
          event.preventDefault();
          const row = rows[currentIndex];
          if (row.entry.isDir) {
            sidebar.toggleExpanded(row.entry.path);
          } else {
            openVaultFile(row.entry.path);
          }
          break;
        }
        case 'h': {
          if (currentIndex === -1) break;
          const row = rows[currentIndex];
          if (row.entry.isDir && sidebar.expanded.has(row.entry.path)) {
            event.preventDefault();
            sidebar.toggleExpanded(row.entry.path);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
