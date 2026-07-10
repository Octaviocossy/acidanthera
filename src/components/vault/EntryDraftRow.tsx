import { useEffect, useRef, useState } from 'react';
import { ChevronGlyph, FileGlyph } from '@/components/vault/glyphs';
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
    <div role="treeitem" tabIndex={-1} style={{ paddingLeft: depth * 12 + 8 }} className="flex h-6 shrink-0 items-center gap-1.5 pr-2 text-sm outline-none">
      {kind === 'directory' ? <ChevronGlyph collapsed /> : <FileGlyph />}
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
        className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-faint"
        spellCheck={false}
        aria-label={kind === 'note' ? 'New note name' : 'New folder name'}
      />
    </div>
  );
}
