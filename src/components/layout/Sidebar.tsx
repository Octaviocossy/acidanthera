import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EntryDraftRow } from '@/components/vault/EntryDraftRow';
import { FileTreeItem } from '@/components/vault/FileTreeItem';
import { ChevronLeftGlyph, ChevronRightGlyph, DocGlyph, FolderGlyph, NewFolderGlyph, NewNoteGlyph, OrbitMarkGlyph, SearchGlyph } from '@/components/vault/glyphs';
import { useSidebarKeymap } from '@/hooks/use-sidebar-keymap';
import { cn } from '@/lib/utils';
import { createVaultEntry, draftPlacement, resolveDraftParent } from '@/lib/vault/create-entry';
import { displayPath } from '@/lib/vault/display-path';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import { openVaultFile } from '@/lib/vault/open-file';
import { pickAndPersistVault } from '@/lib/vault/pick-vault';
import { type VaultEntry, vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { activeEditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { type EntryDraftKind, useSidebarStore } from '@/stores/sidebar-store';

/** Collapsible vault explorer — open/edit/save loop (doc/v0-spec.md §5.3, §6). */
export function Sidebar() {
  useSidebarKeymap();

  const isActive = useAppStore((state) => state.activeRegion === 'sidebar');
  const sidebarExpanded = useAppStore((state) => state.sidebarExpanded);
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const focusRegion = useAppStore((state) => state.focusRegion);
  const collapseSidebar = useAppStore((state) => state.collapseSidebar);
  const expandSidebar = useAppStore((state) => state.expandSidebar);
  const showFileFinder = useFileFinderStore((state) => state.show);

  const tree = useSidebarStore((state) => state.tree);
  const expanded = useSidebarStore((state) => state.expanded);
  const cursorPath = useSidebarStore((state) => state.cursorPath);
  const draft = useSidebarStore((state) => state.draft);
  const setTree = useSidebarStore((state) => state.setTree);
  const toggleExpanded = useSidebarStore((state) => state.toggleExpanded);
  const setCursor = useSidebarStore((state) => state.setCursor);
  const beginDraft = useSidebarStore((state) => state.beginDraft);
  const cancelDraft = useSidebarStore((state) => state.cancelDraft);

  const activeFilePath = useEditorStore((state) => activeEditorBuffer(state)?.filePath);
  const buffers = useEditorStore((state) => state.buffers);

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

  const vaultRows = flattenVisibleTree(tree, expanded);

  /** The mouse twin of the keymap's `a`/`A` (#40) — same parent resolution, same draft. */
  const startDraft = (kind: EntryDraftKind) => {
    const parentPath = resolveDraftParent(vaultRows, cursorPath, vaultRoot);
    if (parentPath === null) return;
    focusRegion('sidebar');
    beginDraft(kind, parentPath);
  };

  /** The rail is a launcher, not a preview: files open in place; directories expand first. */
  const openRailEntry = (entry: VaultEntry) => {
    setCursor(entry.path);
    if (!entry.isDir) {
      openVaultFile(entry.path);
      return;
    }
    expandSidebar();
    if (!expanded.has(entry.path)) toggleExpanded(entry.path);
    focusRegion('sidebar');
  };

  if (!sidebarExpanded) {
    return (
      <aside className="flex h-full w-[var(--rail-sidebar-collapsed)] shrink-0 flex-col items-center border-r border-hairline bg-panel py-3" aria-label="Vault explorer">
        <OrbitMarkGlyph className="mb-1 text-text-secondary" />
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Expand sidebar" title="Expand sidebar" onClick={expandSidebar}>
          <ChevronRightGlyph />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Find file" title="Find file (Ctrl-w f)" aria-haspopup="dialog" onClick={showFileFinder}>
          <SearchGlyph />
        </Button>
        {vaultRoot !== null && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              aria-label="New note"
              title="New note (a)"
              onClick={() => {
                expandSidebar();
                startDraft('note');
              }}
            >
              <NewNoteGlyph />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              aria-label="New folder"
              title="New folder (A)"
              onClick={() => {
                expandSidebar();
                startDraft('directory');
              }}
            >
              <NewFolderGlyph />
            </Button>
            {tree.length > 0 && (
              <div className="mt-1 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
                {tree.map((entry) => (
                  <Button
                    key={entry.path}
                    variant="ghost"
                    size="sm"
                    className={cn('h-6 w-6 shrink-0 p-0', entry.path === activeFilePath && 'bg-elevated text-text-primary')}
                    aria-label={entry.name}
                    title={entry.name}
                    onClick={() => openRailEntry(entry)}
                  >
                    {entry.isDir ? <FolderGlyph /> : <DocGlyph />}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
      </aside>
    );
  }

  const rowElements = vaultRows.map(({ entry, depth }) => {
    return (
      <FileTreeItem
        key={entry.path}
        label={entry.name}
        kind={entry.isDir ? 'dir' : 'file'}
        depth={depth}
        active={entry.path === activeFilePath}
        cursor={entry.path === cursorPath}
        changed={buffers.some((buffer) => buffer.filePath === entry.path && buffer.dirty)}
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
    );
  });

  if (draft !== null) {
    const { index, depth } = draftPlacement(vaultRows, draft);
    rowElements.splice(
      index,
      0,
      <EntryDraftRow key="entry-draft" kind={draft.kind} depth={depth} onCommit={(name) => void createVaultEntry(draft, name)} onCancel={cancelDraft} />
    );
  }

  return (
    <aside
      className={cn('flex h-full w-[var(--rail-sidebar)] shrink-0 flex-col border-r bg-panel', isActive ? 'border-border-strong' : 'border-hairline')}
      aria-label="Vault explorer"
    >
      <div className="flex items-center justify-between gap-1 px-[14px] pt-[14px] pb-2">
        <OrbitMarkGlyph className="text-text-secondary" />
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Find file" title="Find file (Ctrl-w f)" aria-haspopup="dialog" onClick={showFileFinder}>
            <SearchGlyph />
          </Button>
          {vaultRoot !== null && (
            <>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="New note" title="New note (a)" onClick={() => startDraft('note')}>
                <NewNoteGlyph />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="New folder" title="New folder (A)" onClick={() => startDraft('directory')}>
                <NewFolderGlyph />
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={collapseSidebar}>
            <ChevronLeftGlyph />
          </Button>
        </div>
      </div>
      {vaultRoot === null ? (
        <div className="px-[14px]">
          <Button variant="secondary" size="sm" onClick={() => void pickAndPersistVault()}>
            Open vault…
          </Button>
        </div>
      ) : (
        <div role="tree" aria-label="Notes" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[14px] pb-[14px]">
          {rowElements}
        </div>
      )}
      {vaultRoot !== null && (
        <footer className="shrink-0 border-t border-hairline px-[14px] py-2">
          <span className="block min-w-0 truncate font-mono text-meta text-text-muted" title={vaultRoot}>
            {displayPath(vaultRoot)}
          </span>
        </footer>
      )}
    </aside>
  );
}
