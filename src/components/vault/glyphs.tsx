import { cn } from '@/lib/utils';

/**
 * Unicode glyph vocabulary: ✦ AI · ◈ context/file · ⌕ search · ▸/▾ disclosure · ＋ add · ·
 * separator · ~/ vault path. Drawn glyphs are monochrome, currentColor, and hand-tuned at 15px.
 */

/** A directory row's disclosure arrow — rotated, never swapped, so the fold reads as motion. */
export function ChevronGlyph({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      width="15"
      height="15"
      strokeWidth="1.2"
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
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M4 1.5h5l3 3v9.5h-8z" />
    </svg>
  );
}

/** The vault header's "new note" glyph (#40). */
export function NewNoteGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M9.33 1.33H4a1.33 1.33 0 0 0-1.33 1.34v10.66A1.33 1.33 0 0 0 4 14.67h8a1.33 1.33 0 0 0 1.33-1.34V5.33z" />
      <path d="M9.33 1.33v4h4" />
      <path d="M8 12V8M6 10h4" />
    </svg>
  );
}

/** The vault header's "new folder" glyph (#40). */
export function NewFolderGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M2.67 13.33h10.66a1.33 1.33 0 0 0 1.34-1.33V5.33A1.33 1.33 0 0 0 13.33 4H8.07a1.33 1.33 0 0 1-1.13-.6l-.54-.8A1.33 1.33 0 0 0 5.29 2H2.67a1.33 1.33 0 0 0-1.34 1.33V12a1.33 1.33 0 0 0 1.34 1.33z" />
      <path d="M8 10.67v-4M6 8.67h4" />
    </svg>
  );
}

interface GlyphProps {
  className?: string;
}

export function DocGlyph({ className }: GlyphProps) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-[15px] w-[15px]', className)}
      aria-hidden="true"
    >
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </svg>
  );
}

export function FolderGlyph({ className }: GlyphProps) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-[15px] w-[15px]', className)}
      aria-hidden="true"
    >
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.5h4.8A1.5 1.5 0 0 1 14 6v5.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
    </svg>
  );
}

export function CogGlyph({ className }: GlyphProps) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-[15px] w-[15px]', className)}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v2.1M8 12.1v2.1M1.8 8h2.1M12.1 8h2.1M3.6 3.6l1.5 1.5M10.9 10.9l1.5 1.5M12.4 3.6l-1.5 1.5M5.1 10.9l-1.5 1.5" />
    </svg>
  );
}
