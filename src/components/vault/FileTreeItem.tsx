import { ChevronGlyph, FileGlyph } from '@/components/vault/glyphs';
import { cn } from '@/lib/utils';

export interface FileTreeItemProps {
  label: string;
  kind: 'file' | 'dir';
  depth: number;
  /** The open file — raised `--surface-2` (doc/v0-spec.md §5.3). */
  active?: boolean;
  /** The vim keyboard cursor — a thin inset `--border-active` bar, no fill (doc/v0-spec.md §5.3). */
  cursor?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

/** Sidebar vault-explorer row (doc/v0-spec.md §5.3, §5.6 component inventory). */
export function FileTreeItem({ label, kind, depth, active = false, cursor = false, collapsed = false, onClick }: FileTreeItemProps) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: keyboard interaction is region-scoped via useSidebarKeymap (window-level, vim-style), not per-row DOM focus.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same as above — onClick is a mouse affordance alongside the keyboard path, not a replacement for it.
    <div
      role="treeitem"
      aria-selected={active}
      aria-expanded={kind === 'dir' ? !collapsed : undefined}
      onClick={onClick}
      style={{ paddingLeft: depth * 12 + 8 }}
      className={cn(
        'relative flex h-6 shrink-0 cursor-pointer select-none items-center gap-1.5 pr-2 font-mono text-sm',
        active ? 'bg-surface-2 text-text' : 'text-text-dim hover:text-text'
      )}
    >
      {cursor && <span className="absolute inset-y-0 left-0 w-0.5 bg-border-active" aria-hidden="true" />}
      {kind === 'dir' ? <ChevronGlyph collapsed={collapsed} /> : <FileGlyph />}
      <span className="truncate">{label}</span>
    </div>
  );
}
