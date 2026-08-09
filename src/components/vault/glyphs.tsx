/**
 * Unicode glyph vocabulary: ✦ AI · ◈ context/file · ⌕ search · ▸/▾ disclosure · ＋ add · ·
 * separator · ~/ vault path. Only the hand-drawn brand mark remains here; application icons use
 * the Icon primitive.
 */

interface GlyphProps {
  className?: string;
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
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
    </svg>
  );
}
