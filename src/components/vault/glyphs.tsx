/**
 * Unicode glyph vocabulary: ✦ AI · ◈ context/file · ⌕ search · ▸/▾ disclosure · ＋ add · ·
 * separator · ~/ vault path. Only the hand-drawn brand mark remains here; application icons use
 * the Icon primitive.
 */

interface GlyphProps {
  className?: string;
}

/**
 * The acidanthera brand mark: a vertically-stretched hexagon with points top and bottom and
 * vertical side edges, six circular arcs bowing inward from each edge, and a ring at the centre.
 *
 * Reconstructed as stroked geometry rather than autotraced — a trace yields filled paths, which
 * cannot carry the house 1.2px stroke. The source render has neither a constant arc radius nor a
 * constant sagitta (the vertical edges measure a 3.89 sagitta, the diagonals 3.34), so one rule is
 * applied to all six: a constant sagitta of 3.72, giving R 7.28 across the side edges and R 7.897
 * across the diagonals.
 *
 * It stays monochrome. The ember ring belongs to the app icon and favicon alone, which never
 * render inside the window — ember marks AI agency everywhere else (ADR 0032).
 */
export function AcidantheraMarkGlyph({ className }: GlyphProps) {
  return (
    <svg
      width="24"
      height="28"
      viewBox="0 0 24 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .6 L23.4 7.65 L23.4 20.35 L12 27.4 L.6 20.35 L.6 7.65 Z" />
      <path d="M12 .6 A7.897 7.897 0 0 0 23.4 7.65 A7.28 7.28 0 0 0 23.4 20.35 A7.897 7.897 0 0 0 12 27.4 A7.897 7.897 0 0 0 .6 20.35 A7.28 7.28 0 0 0 .6 7.65 A7.897 7.897 0 0 0 12 .6 Z" />
      <circle cx="12" cy="14" r="1.73" />
    </svg>
  );
}
