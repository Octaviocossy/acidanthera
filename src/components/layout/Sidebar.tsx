import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileTreeItem } from '@/components/vault/FileTreeItem';
import { useSidebarKeymap } from '@/hooks/use-sidebar-keymap';
import { cn } from '@/lib/utils';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import { openVaultFile } from '@/lib/vault/open-file';
import { vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';

/** Collapsible vault explorer — open/edit/save loop (doc/v0-spec.md §5.3, §6). */
export function Sidebar() {
  useSidebarKeymap();

  const isActive = useAppStore((state) => state.activeRegion === 'sidebar');
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const setVaultRoot = useAppStore((state) => state.setVaultRoot);
  const focusRegion = useAppStore((state) => state.focusRegion);

  const tree = useSidebarStore((state) => state.tree);
  const expanded = useSidebarStore((state) => state.expanded);
  const cursorPath = useSidebarStore((state) => state.cursorPath);
  const setTree = useSidebarStore((state) => state.setTree);
  const toggleExpanded = useSidebarStore((state) => state.toggleExpanded);
  const setCursor = useSidebarStore((state) => state.setCursor);

  const activeFilePath = useEditorStore((state) => state.filePath);

  useEffect(() => {
    if (vaultRoot === null) return;
    vaultService.readVaultTree().then(setTree);
  }, [vaultRoot, setTree]);

  useEffect(() => {
    const unlistenPromise = vaultService.onVaultChanged(() => {
      if (useAppStore.getState().vaultRoot === null) return;
      vaultService.readVaultTree().then(setTree);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setTree]);

  const handleOpenVault = async () => {
    try {
      const root = await vaultService.pickVault();
      setVaultRoot(root);
    } catch {
      // Dialog was cancelled — nothing to do.
    }
  };

  const rows = flattenVisibleTree(tree, expanded);

  return (
    <aside
      className={cn('flex h-full w-[var(--rail-sidebar)] shrink-0 flex-col border-r bg-surface', isActive ? 'border-border-active' : 'border-border-hairline')}
      aria-label="Vault explorer"
    >
      <div className="px-3 py-2 font-mono text-text-faint text-xs uppercase tracking-caps">Vault</div>
      {vaultRoot === null ? (
        <div className="px-3">
          <Button variant="ghost" size="sm" onClick={handleOpenVault}>
            Open vault…
          </Button>
        </div>
      ) : (
        <div role="tree" aria-label="Notes" className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
          {rows.map(({ entry, depth }) => (
            <FileTreeItem
              key={entry.path}
              label={entry.name}
              kind={entry.isDir ? 'dir' : 'file'}
              depth={depth}
              active={entry.path === activeFilePath}
              cursor={entry.path === cursorPath}
              collapsed={entry.isDir && !expanded.has(entry.path)}
              onClick={() => {
                focusRegion('sidebar');
                setCursor(entry.path);
                if (entry.isDir) {
                  toggleExpanded(entry.path);
                } else {
                  openVaultFile(entry.path);
                }
              }}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
