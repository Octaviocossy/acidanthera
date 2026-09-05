import { ChevronRight, FileText, Folder, Icon } from '@/components/ui/icon';
import { InlineNameInput } from '@/components/vault/InlineNameInput';
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
  return (
    <InlineNameInput
      depth={depth}
      icon={
        <>
          {kind === 'directory' && <Icon icon={ChevronRight} size={12} className={cn('shrink-0 transition-transform duration-[var(--dur)] ease-acidanthera')} />}
          {kind === 'directory' ? <Icon icon={Folder} size={15} className="opacity-65" /> : <Icon icon={FileText} size={15} className="opacity-65" />}
        </>
      }
      placeholder={kind === 'note' ? 'note name' : 'folder name'}
      ariaLabel={kind === 'note' ? 'New note name' : 'New folder name'}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
}
