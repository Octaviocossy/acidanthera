import type { ReactNode } from 'react';
import { ChevronGlyph, DocGlyph, FolderGlyph } from '@/components/vault/glyphs';
import { cn } from '@/lib/utils';

export interface FileTreeItemProps {
  label: ReactNode;
  kind: 'file' | 'dir';
  depth: number;
  /** The open buffer, visually distinct from the keyboard cursor. */
  active?: boolean;
  /** The keyboard-navigation cursor, which can rest on a non-open row. */
  cursor?: boolean;
  /** An open buffer with unsaved changes. */
  changed?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

/** Sidebar vault-explorer row (doc/v0-spec.md §5.3, §5.6 component inventory). */
export function FileTreeItem({ label, kind, depth, active = false, cursor = false, changed = false, collapsed = false, onClick }: FileTreeItemProps) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: keyboard interaction is region-scoped via useSidebarKeymap (window-level, vim-style), not per-row DOM focus.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same as above — onClick is a mouse affordance alongside the keyboard path, not a replacement for it.
    <div
      role="treeitem"
      aria-selected={active}
      aria-expanded={kind === 'dir' ? !collapsed : undefined}
      onClick={onClick}
      style={{ paddingLeft: depth * 12 + 10 }}
      className={cn(
        'flex shrink-0 cursor-pointer select-none items-center gap-[9px] rounded-item px-2.5 py-2 font-sans text-body leading-[var(--leading-ui)] transition-[background-color,color] duration-[150ms] ease-[ease]',
        active ? 'bg-elevated text-text-primary' : cursor ? 'bg-hover text-text-secondary' : 'bg-transparent text-text-secondary hover:bg-hover'
      )}
    >
      {kind === 'dir' ? (
        <>
          <span className={active ? 'opacity-80' : 'opacity-65'}>
            <ChevronGlyph collapsed={collapsed} />
          </span>
          <FolderGlyph className={active ? 'opacity-80' : 'opacity-65'} />
        </>
      ) : (
        <DocGlyph className={active ? 'opacity-80' : 'opacity-65'} />
      )}
      <span className="min-w-0 truncate">{label}</span>
      {changed && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-pill bg-accent" aria-hidden="true" />}
    </div>
  );
}
