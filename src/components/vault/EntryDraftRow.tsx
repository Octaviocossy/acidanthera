import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileText, Folder, Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { EntryDraftKind } from '@/stores/sidebar-store';

export interface EntryDraftRowProps {
  kind: EntryDraftKind;
  depth: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/**
 * The inline "name your new entry" row (#40): `FileTreeItem`'s geometry with an auto-focused input
 * in the label slot, rendered at the position the entry will occupy so the target directory reads
 * off the indent alone. `Enter` commits, `Escape` and blur cancel.
 *
 * The input is why `useSidebarKeymap` never fires while a draft is open — it guards on
 * `isEditableTarget`, so `j`/`k`/`a` are plain characters here.
 */
export function EntryDraftRow({ kind, depth, onCommit, onCancel }: EntryDraftRowProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      role="treeitem"
      tabIndex={-1}
      style={{ paddingLeft: depth * 12 + 10 }}
      className="flex shrink-0 items-center gap-[9px] rounded-item px-2.5 py-2 font-sans text-body leading-[var(--leading-ui)] text-text-secondary outline-none"
    >
      {kind === 'directory' && <Icon icon={ChevronRight} size={12} className={cn('shrink-0 transition-transform duration-[var(--dur)] ease-orbit')} />}
      {kind === 'directory' ? <Icon icon={Folder} size={15} className="opacity-65" /> : <Icon icon={FileText} size={15} className="opacity-65" />}
      <input
        ref={inputRef}
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onCommit(name);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        onBlur={onCancel}
        placeholder={kind === 'note' ? 'note name' : 'folder name'}
        className="min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-muted"
        spellCheck={false}
        aria-label={kind === 'note' ? 'New note name' : 'New folder name'}
      />
    </div>
  );
}
