/**
 * Unicode glyph vocabulary: ✦ AI · ◈ context/file · ⌕ search · ▸/▾ disclosure · ＋ add · ·
 * separator · ~/ vault path. Only the hand-drawn brand mark remains here; application icons use
 * the Icon primitive.
 */

interface GlyphProps {
  className?: string;
}

/**
 * The brand mark's outline: a regular pointy-top hexagon minus a six-point concave star, in the
 * glyph's own coordinates (centred on the origin, circumradius 14). Filled with `evenodd`, so the
 * star is a knockout and whatever surface sits behind the mark shows through it.
 *
 * Every brand SVG — the favicon, the mark master, both lockups and the app-icon master — embeds
 * this exact string and positions it only with `transform`; `glyphs.test.ts` fails on a copy that
 * drifts. Change the geometry here, then paste it into each of them.
 */
export const ACIDANTHERA_MARK_PATH =
  'M0 -14 L12.124 -7 L12.124 7 L0 14 L-12.124 7 L-12.124 -7 Z M0 -11.2 A8.018 8.018 0 0 0 9.699 -5.6 A8.018 8.018 0 0 0 9.699 5.6 A8.018 8.018 0 0 0 0 11.2 A8.018 8.018 0 0 0 -9.699 5.6 A8.018 8.018 0 0 0 -9.699 -5.6 A8.018 8.018 0 0 0 0 -11.2 Z';

/** Radius of the mark's *ember centre*, drawn at the origin. */
export const ACIDANTHERA_MARK_DOT_RADIUS = 2.52;

/**
 * The acidanthera *brand mark*: a filled hexagon with a six-point concave star knocked out and an
 * *ember centre*. Filled rather than stroked — the house 1.2px stroke governs icons, and the mark is
 * not one; a stroked mark's six arcs converged on each vertex and smudged below 24px. One geometry
 * serves every size (brand-refresh spec, decisions 1–2).
 *
 * The ember centre renders wherever the mark renders. The brand mark is **identity rather than
 * signal**, so the accent system does not govern it at all (ADR 0122). The exemption covers the
 * mark, never a fill behind it.
 */
export function AcidantheraMarkGlyph({ className }: GlyphProps) {
  return (
    <svg width="24" height="28" viewBox="-12.124 -14 24.249 28" fill="none" className={className} aria-hidden="true">
      <path d={ACIDANTHERA_MARK_PATH} fill="currentColor" fillRule="evenodd" />
      <circle cx="0" cy="0" r={ACIDANTHERA_MARK_DOT_RADIUS} className="fill-accent" />
    </svg>
  );
}
