import { type ReactNode, useEffect, useRef, useState } from 'react';
import { NOTE_META_LINE } from '@/components/vault/FileTreeItem';

export interface InlineNameInputProps {
  initialValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  depth: number;
  icon?: ReactNode;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/** A tree row whose label is an auto-focused entry-name input. */
export function InlineNameInput({ initialValue = '', placeholder, ariaLabel, depth, icon, onCommit, onCancel }: InlineNameInputProps) {
  const [name, setName] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (initialValue !== '') inputRef.current?.select();
  }, [initialValue]);

  return (
    <div
      role="treeitem"
      tabIndex={-1}
      style={{ paddingLeft: depth * 12 + 10 }}
      className="flex shrink-0 items-center gap-[9px] rounded-item px-2.5 py-2 font-sans text-body leading-[var(--leading-ui)] text-text-secondary outline-none"
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
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
          placeholder={placeholder}
          className="min-w-0 bg-transparent text-text-primary outline-none placeholder:text-text-muted"
          spellCheck={false}
          aria-label={ariaLabel}
        />
        {/* Deliberately blank: an entry being named has no edit time, and inventing one — or
            leaving the row a line short and shifting everything below it — is worse than an empty
            line (spec decision 36). */}
        <span className={NOTE_META_LINE} aria-hidden="true" />
      </span>
    </div>
  );
}
