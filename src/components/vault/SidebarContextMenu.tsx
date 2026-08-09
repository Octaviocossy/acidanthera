import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NewFolderGlyph, NewNoteGlyph } from '@/components/vault/glyphs';
import { pushModalOverlay } from '@/lib/keymap/modal-overlay';
import { resolveParentForTarget } from '@/lib/vault/create-entry';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import { useAppStore } from '@/stores/app-store';
import { useContextMenuStore } from '@/stores/context-menu-store';
import { type EntryDraftKind, useSidebarStore } from '@/stores/sidebar-store';

interface MenuPosition {
  left: number;
  top: number;
}

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
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

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
    const parentPath = resolveParentForTarget(flattenVisibleTree(tree, expanded), target, vaultRoot);
    if (parentPath === null) return;
    beginDraft(kind, parentPath);
    hide();
  };

  if (!open) return null;

  return (
    <div ref={layerRef} role="presentation" className="absolute inset-0 z-10">
      <div
        ref={panelRef}
        role="menu"
        aria-label="Sidebar actions"
        className="absolute min-w-40 rounded-card border border-border-strong bg-elevated p-1 shadow-[var(--shadow-overlay-dark)]"
        style={position === null ? { visibility: 'hidden' } : { left: position.left, top: position.top }}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: menu actions are deliberately mouse-only; sidebar chords remain region-scoped. */}
        {/* biome-ignore lint/a11y/useFocusableInteractive: menu actions intentionally have no tabIndex or DOM focus. */}
        <div
          role="menuitem"
          className="flex cursor-pointer items-center gap-[9px] rounded-item px-2.5 py-2 font-sans text-body text-text-secondary hover:bg-hover"
          onClick={() => startDraft('note')}
        >
          <NewNoteGlyph />
          New note
        </div>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: menu actions are deliberately mouse-only; sidebar chords remain region-scoped. */}
        {/* biome-ignore lint/a11y/useFocusableInteractive: menu actions intentionally have no tabIndex or DOM focus. */}
        <div
          role="menuitem"
          className="flex cursor-pointer items-center gap-[9px] rounded-item px-2.5 py-2 font-sans text-body text-text-secondary hover:bg-hover"
          onClick={() => startDraft('directory')}
        >
          <NewFolderGlyph />
          New folder
        </div>
      </div>
    </div>
  );
}
