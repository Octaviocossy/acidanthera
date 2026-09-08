import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { ChevronRight, FileText, Folder, Icon } from '@/components/ui/icon';
import { tooltipTarget } from '@/lib/tooltip/tooltip-overlay';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/vault/relative-time';

/**
 * A note row's second line. Exported because `InlineNameInput` reproduces this row's geometry and
 * must keep the pair the same height — it renders this line blank rather than duplicating a calc
 * that could drift (spec decision 36).
 */
export const NOTE_META_LINE = 'h-[calc(var(--font-size-meta)*var(--leading-ui))] font-mono text-meta text-text-muted leading-[var(--leading-ui)]';

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
  /** A note's mtime in ms. `null` when it could not be read — the meta line is then omitted. */
  modified?: number | null;
  /** Notes beneath a directory, at any depth. Meaningless on a note row. */
  noteCount?: number;
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
}

/**
 * Sidebar vault-explorer row (doc/v0-spec.md §5.3, §5.6 component inventory).
 *
 * Two lines for a note — title, then `edited <relative>` — and one for a directory, muted and
 * carrying a recursive note count. That asymmetry is what makes a folder read as a subdued group
 * header inside what stays a real tree at every depth (spec decisions 6, 23, 26).
 */
export function FileTreeItem({
  label,
  kind,
  depth,
  active = false,
  cursor = false,
  changed = false,
  collapsed = false,
  modified = null,
  noteCount,
  onClick,
  onContextMenu,
}: FileTreeItemProps) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: keyboard interaction is region-scoped via useSidebarKeymap (window-level, vim-style), not per-row DOM focus.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same as above — onClick is a mouse affordance alongside the keyboard path, not a replacement for it.
    <div
      role="treeitem"
      aria-selected={active}
      aria-expanded={kind === 'dir' ? !collapsed : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ paddingLeft: depth * 12 + 10 }}
      className={cn(
        'flex shrink-0 cursor-pointer select-none items-center gap-[9px] rounded-item px-2.5 py-2 font-sans text-body leading-[var(--leading-ui)] transition-[background-color,color] duration-[150ms] ease-[ease]',
        active ? 'bg-elevated text-text-primary' : cursor ? 'bg-hover text-text-secondary' : 'bg-transparent text-text-secondary hover:bg-hover'
      )}
    >
      {kind === 'dir' ? (
        <>
          <span className={active ? 'opacity-80' : 'opacity-65'}>
            <Icon icon={ChevronRight} size={12} className={cn('shrink-0 transition-transform duration-[var(--dur)] ease-acidanthera', collapsed ? '' : 'rotate-90')} />
          </span>
          <Icon icon={Folder} size={15} className={active ? 'opacity-80' : 'opacity-65'} />
          <span className={cn('min-w-0 truncate text-meta', !active && 'text-text-muted')} {...tooltipTarget(label, { whenTruncated: true })}>
            {label}
          </span>
          {/* The dot keeps its meaning and its ember (spec decision 11); the count goes last.
              The count is hidden from the accessible name — unlike a note's edited time, which
              exists nowhere else, it only summarizes child rows the tree already enumerates, and
              folding it in would name this row "notes 1". */}
          <span className="ml-auto flex shrink-0 items-center gap-[9px]" aria-hidden="true">
            {changed && <span className="h-1.5 w-1.5 rounded-pill bg-accent" />}
            {noteCount !== undefined && <span className="font-mono text-meta text-text-muted">{noteCount}</span>}
          </span>
        </>
      ) : (
        <>
          <Icon icon={FileText} size={15} className={active ? 'opacity-80' : 'opacity-65'} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate" {...tooltipTarget(label, { whenTruncated: true })}>
              {label}
            </span>
            {/* Omitted rather than placeholdered when the mtime could not be read: a note shows its
                title alone instead of being given an edit time that does not exist. */}
            {modified !== null && <span className={cn(NOTE_META_LINE, 'truncate')}>edited {relativeTime(modified)}</span>}
          </span>
          {changed && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-pill bg-accent" aria-hidden="true" />}
        </>
      )}
    </div>
  );
}
