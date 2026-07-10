import { cn } from '@/lib/utils';

/**
 * The sidebar's hairline glyphs (doc/v0-spec.md §5.6): monochrome, `currentColor`, sized to the
 * 24px row. Shared by `FileTreeItem`, `EntryDraftRow` and the vault header's create buttons.
 */

/** A directory row's disclosure arrow — rotated, never swapped, so the fold reads as motion. */
export function ChevronGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-3 w-3 shrink-0 transition-transform duration-[var(--dur)] ease-orbit', collapsed ? '' : 'rotate-90')}
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

/** A note row's document glyph. */
export function FileGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M4 1.5h5l3 3v9.5h-8z" />
    </svg>
  );
}

/** The vault header's "new note" glyph (#40). */
export function NewNoteGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6M9 15h6" />
    </svg>
  );
}

/** The vault header's "new folder" glyph (#40). */
export function NewFolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
      <path d="M12 16v-6M9 13h6" />
    </svg>
  );
}
