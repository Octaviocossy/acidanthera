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

/** The destructive dialog's trash glyph. Colored by its container, never hardcoded. */
export function TrashGlyph({ className }: GlyphProps) {
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
      <path d="M3.5 4.5h9M6.25 4.5V3.25h3.5V4.5M5 4.5l.6 8.25h4.8L11 4.5M7 7v3.25M9 7v3.25" />
    </svg>
  );
}

export function SearchGlyph({ className }: GlyphProps) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      className={cn('h-[15px] w-[15px]', className)}
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </svg>
  );
}

/** Placeholder brand mark until the official one exists. It stays monochrome: ember marks AI agency. */
export function OrbitMarkGlyph({ className }: GlyphProps) {
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
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
    </svg>
  );
}

/** A tab close glyph. */
export function CloseGlyph({ className }: GlyphProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      className={cn('h-4 w-4', className)}
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
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
      <circle cx="8" cy="8" r="4.6" />
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.3v1.9M8 12.8v1.9M1.3 8h1.9M12.8 8h1.9M3.3 3.3l1.35 1.35M11.35 11.35l1.35 1.35M12.7 3.3l-1.35 1.35M4.65 11.35L3.3 12.7" />
    </svg>
  );
}

export function ChevronLeftGlyph() {
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
      className="h-[15px] w-[15px]"
      aria-hidden="true"
    >
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </svg>
  );
}

export function ChevronRightGlyph() {
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
      className="h-[15px] w-[15px]"
      aria-hidden="true"
    >
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}
