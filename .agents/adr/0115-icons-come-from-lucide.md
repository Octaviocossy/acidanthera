# Icons come from Lucide

`src/components/vault/glyphs.tsx` held twelve SVGs hand-tuned to a 16 viewBox at 1.2px stroke,
and the glossary recorded that choice as deliberate: "matched by hand rather than by adding an
icon dependency". That reasoning held while the set was small and static. The context-menu rework
needs a pencil and a duplicate mark, and every future surface needs the next two — the hand-drawn
set was becoming a private icon library maintained by one person. Orbit now takes its icons from
`lucide-react`.

Lucide already agrees with the house style on everything that matters — `currentColor`, no fill,
round caps and joins — so the migration is a swap, not a restyle. The one mismatch is stroke
weight: Lucide's 24 viewBox at `strokeWidth` 2 renders 1.25px at 15px but only 1.0px at the 12px
used in sidebar rows. A single `Icon` wrapper pins `strokeWidth={1.2}` with `absoluteStrokeWidth`,
so the house spec holds at every size and lives in exactly one file.

Two things stay hand-drawn on purpose. `OrbitMarkGlyph` is a brand mark, not an icon, and no
library ships it. The Unicode characters that live *inside text* — `◈` and `＋` in `Chip`, `✦` in
`SectionLabel`, the titlebar chat toggle and `ChatMessage`, `⌕` in `FileFinder` — are typography,
not iconography; replacing them would change the DOM shape of components whose tests assert on the
character itself.
