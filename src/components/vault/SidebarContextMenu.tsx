import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Copy, FilePlus, FolderPlus, Icon, type LucideIcon, Pencil, Trash2 } from '@/components/ui/icon';
import { Kbd } from '@/components/ui/kbd';
import type { AppCommandId } from '@/lib/app-command';
import { formatChord } from '@/lib/keymap/format-chord';
import { pushModalOverlay } from '@/lib/keymap/modal-overlay';
import { cn } from '@/lib/utils';
import { resolveParentForTarget } from '@/lib/vault/create-entry';
import { deleteVaultEntry } from '@/lib/vault/delete-entry';
import { duplicateVaultEntry } from '@/lib/vault/duplicate-entry';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import { useAppStore } from '@/stores/app-store';
import { useContextMenuStore } from '@/stores/context-menu-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { type EntryDraftKind, useSidebarStore } from '@/stores/sidebar-store';

interface MenuPosition {
  left: number;
  top: number;
}

type TargetKind = 'root' | 'directory' | 'note' | null;
type MenuAction = 'new-note' | 'new-directory' | 'rename' | 'duplicate' | 'summarize' | 'related' | 'delete';

interface MenuRow {
  action: MenuAction;
  label: string;
  icon?: LucideIcon;
  command?: AppCommandId;
  shown: (targetKind: TargetKind) => boolean;
}

const MENU_GROUPS: readonly (readonly MenuRow[])[] = [
  [
    { action: 'new-note', label: 'New note', icon: FilePlus, command: 'sidebar.new-note', shown: () => true },
    { action: 'new-directory', label: 'New folder', icon: FolderPlus, command: 'sidebar.new-directory', shown: () => true },
  ],
  [
    { action: 'rename', label: 'Rename', icon: Pencil, command: 'sidebar.rename', shown: (targetKind) => targetKind === 'directory' || targetKind === 'note' },
    { action: 'duplicate', label: 'Duplicate', icon: Copy, command: 'sidebar.duplicate', shown: (targetKind) => targetKind === 'directory' || targetKind === 'note' },
  ],
  [
    { action: 'summarize', label: 'Summarize note', shown: (targetKind) => targetKind === 'note' },
    { action: 'related', label: 'Find related notes', shown: (targetKind) => targetKind === 'note' },
  ],
  [{ action: 'delete', label: 'Move to Trash', icon: Trash2, command: 'sidebar.delete', shown: (targetKind) => targetKind === 'directory' || targetKind === 'note' }],
];

/** App-drawn sidebar menu, mounted outside the scrollable explorer so it cannot be clipped. */
export function SidebarContextMenu() {
  const open = useContextMenuStore((state) => state.open);
  const x = useContextMenuStore((state) => state.x);
  const y = useContextMenuStore((state) => state.y);
  const target = useContextMenuStore((state) => state.target);
  const hide = useContextMenuStore((state) => state.hide);
  const tree = useSidebarStore((state) => state.tree);
  const expanded = useSidebarStore((state) => state.expanded);
  const beginDraft = useSidebarStore((state) => state.beginDraft);
  const beginRename = useSidebarStore((state) => state.beginRename);
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const sidebarBindings = useKeymapStore((state) => state.resolved.layers.sidebar);
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const visibleRows = flattenVisibleTree(tree, expanded);
  const targetEntry = target === null ? null : (visibleRows.find((row) => row.entry.path === target)?.entry ?? null);
  const targetKind: TargetKind = target === null ? 'root' : targetEntry === null ? null : targetEntry.isDir ? 'directory' : 'note';
  const visibleGroups = MENU_GROUPS.map((group) => group.filter((row) => row.shown(targetKind))).filter((group) => group.length > 0);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const layer = layerRef.current;
    const panel = panelRef.current;
    if (layer === null || panel === null) return;

    const layerBounds = layer.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    setPosition({
      left: Math.max(0, Math.min(x - layerBounds.left, Math.max(0, layerBounds.width - panelBounds.width))),
      top: Math.max(0, Math.min(y - layerBounds.top, Math.max(0, layerBounds.height - panelBounds.height))),
    });
  }, [open, x, y]);

  useEffect(() => {
    if (!open) return;

    const dismissOnOutsideMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) hide();
    };

    window.addEventListener('mousedown', dismissOnOutsideMouseDown);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      window.removeEventListener('mousedown', dismissOnOutsideMouseDown);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, [open, hide]);

  useEffect(() => {
    if (!open) return;
    return pushModalOverlay({ id: 'sidebar-context-menu', onCancel: hide });
  }, [open, hide]);

  const startDraft = (kind: EntryDraftKind) => {
    const parentPath = resolveParentForTarget(visibleRows, target, vaultRoot);
    if (parentPath === null) return;
    beginDraft(kind, parentPath);
    hide();
  };

  const selectAction = (action: MenuAction) => {
    switch (action) {
      case 'new-note':
        startDraft('note');
        break;
      case 'new-directory':
        startDraft('directory');
        break;
      case 'rename':
        if (target !== null) {
          hide();
          beginRename(target);
        }
        break;
      case 'duplicate':
        if (target !== null) {
          hide();
          void duplicateVaultEntry(target);
        }
        break;
      case 'delete':
        if (target !== null) {
          hide();
          void deleteVaultEntry(target, visibleRows);
        }
        break;
      case 'summarize':
      case 'related':
        break;
    }
  };

  if (!open) return null;

  return (
    <div ref={layerRef} role="presentation" className="absolute inset-0 z-10">
      <div
        ref={panelRef}
        role="menu"
        aria-label="Sidebar actions"
        className="absolute w-[210px] rounded-card border border-border-strong bg-elevated p-1.5"
        style={position === null ? { visibility: 'hidden' } : { left: position.left, top: position.top }}
      >
        {visibleGroups.map((group, groupIndex) => (
          <div key={group[0].action}>
            {groupIndex > 0 && <div className="my-1.5 border-t border-hairline" />}
            {group.map((row) => {
              const placeholder = row.command === undefined;
              const danger = row.action === 'delete';
              const hint = row.command === undefined ? undefined : formatChord(sidebarBindings.get(row.command));

              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: menu actions are deliberately mouse-only; sidebar chords remain region-scoped.
                // biome-ignore lint/a11y/useFocusableInteractive: menu actions intentionally have no tabIndex or DOM focus.
                <div
                  key={row.action}
                  role="menuitem"
                  aria-disabled={placeholder || undefined}
                  title={placeholder ? 'Coming soon' : undefined}
                  className={cn(
                    'flex items-center gap-[9px] rounded-item px-2.5 py-2.5 font-sans text-body',
                    placeholder ? 'cursor-default text-text-secondary' : danger ? 'cursor-pointer text-danger hover:bg-hover' : 'cursor-pointer text-text-secondary hover:bg-hover'
                  )}
                  onClick={placeholder ? undefined : () => selectAction(row.action)}
                >
                  {placeholder ? (
                    <span className="text-accent opacity-50" aria-hidden="true">
                      ✦
                    </span>
                  ) : (
                    <Icon icon={row.icon as LucideIcon} size={15} className={danger ? 'text-danger' : undefined} />
                  )}
                  <span className={danger ? 'text-danger' : undefined}>{row.label}</span>
                  {hint !== undefined && (
                    <Kbd boxed={false} className="ml-auto shrink-0" aria-hidden="true">
                      {hint}
                    </Kbd>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
