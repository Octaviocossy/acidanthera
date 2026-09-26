# Spec: Brand Refresh — a Filled Mark That Survives Small Sizes

> Status: **settled**
> Created: 2026-09-26
> Grilled: 2026-09-26 — 3 rounds, 18 decisions
> Suggested next: /create-issue

## Goal

Replace the acidanthera brand mark everywhere it appears, in-app and out, with the new filled
design supplied as renders in `assets/acidanthera-brand/`. The current mark is six 1.2px arcs
converging on each vertex of a stroked hexagon, and at 16–24px those strokes merge into a smudge;
the new one is a solid hexagon with a star knocked out of it, which keeps a solid band even at
the vertices.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | How is the vector obtained from the supplied PNGs? | **Geometric reconstruction**: a regular pointy-top hexagon, filled, minus a six-point concave star (`fill-rule="evenodd"`, so the ground shows through the star), plus a centred circle. `fill="currentColor"`, no stroke. Starting geometry: `viewBox="-12.124 -14 24.249 28"`, circumradius 14, star tips at 11.2 (0.80R) on the vertex axes, six arcs of radius 8.018 whose deepest point sits at 7.42 (0.53R), dot radius 2.52 (0.18R) | The renders are ChatGPT rasters with no alpha, visible noise and irregular proportions (h/w 1.125–1.146 against a regular hexagon's 1.155; star tips 0.75–0.82R depending on axis). An autotrace would inherit all of it; the measured parameters are the renders' average, normalised |
| 2 | One geometry at every size, or an optical small-size variant? | **One geometry** | The simplification *is* the fix. Verified before closing: a headless-Chrome render at 16×18, 24×28 and 56×65, at 1x and 2x, on both themes' surfaces, reads as hexagon, star and dot at every size; the old mark smudges at 16×18. The thinnest band (at the vertices) is 1.8px at 16×18 |
| 3 | In-app tint of the hexagon | **Mixed**: `text-text-primary` on the *home surface*; `text-text-secondary` in the sidebar — collapsed rail, brand row, footer identity tile | On the home surface mark and wordmark form the lockup, and the wordmark is already `--text-primary`, which is also exactly the hexagon's ink in the renders. In the sidebar a solid fill in `--text-primary` would become the brightest element of the chrome |
| 4 | Colour of the dot in-app | The **`--accent` token** (`fill-accent`, replacing today's `stroke-accent`) | Stays identical to the ember the rest of the app shows in each theme. A fixed hex would be a "brand colour" — an alias the glossary's *AI accent* row tells us to avoid |
| 5 | What is the ember element called now that it is not a ring? | **"ember centre"** | Shape-neutral, so the next redraw does not reopen invariants 21 and 27; and it keeps the mark's element verbally distinct from the *dirty-note dot*, the other ember exemption in invariant 21 |
| 6 | App icon (`.icns`, `.ico`, the PNGs of `src-tauri/icons/`, 17 files) | An **SVG master** with the current icon's finish — dark squircle on the macOS 1024 grid, transparent corners, the current icon's subtle edge and soft shadow — with the new mark centred, in the proportion the current icon uses. `tauri icon` regenerates all 17 files from it | `tauri icon` accepts an SVG directly, so there is no hand rasterisation step. Render (5) is a mockup with a heavy bevel on a white ground with no alpha; cleaning it would inherit its noise and geometry |
| 7 | What is the canonical wordmark? | **Geist, live text**, as today: the home surface keeps `acidanthera` in Geist medium at `--font-size-hero`. The lockups are built from Geist Medium outlines. The renders' lettering is reference only | Continues the rebrand's "no brand typeface" decision (`2026-09-04-rebrand-to-acidanthera.md` decision 4). The renders' lettering is not an identifiable face and would carry the render's irregularities into a custom wordmark |
| 8 | Layout of the brand asset directory | **One `assets/brand/`**: SVG masters (mark, dark lockup, light lockup, app icon) are the source of truth; the five ChatGPT PNGs move, renamed descriptively, to `assets/brand/source/` as reference renders; the old lockup PNGs, the old `source/` contents and `assets/acidanthera-brand/` are deleted | Git history keeps the old assets; two brand directories would leave nobody sure which is current. `public/brand/` stays the home of what ships (the favicon), per the rebrand's decision 9 |
| 9 | Favicon (`public/brand/favicon.svg`, visible only in a browser tab under `pnpm dev`) | The filled mark, **adaptive**: an `@media (prefers-color-scheme)` rule inside the SVG sets the hexagon `#26251e` on light tabs and `#ecedee` on dark tabs; the dot follows decision 14 | Today's fixed `#e2dfdb` ink is invisible on a light tab. A favicon cannot inherit `currentColor`, so fixed ink needs the media query to follow the tab |
| 10 | Sizes of the four in-app placements | **Unchanged**: collapsed rail and brand row 24×28 (the glyph's intrinsic size), footer tile 16×18, home surface 56×65 | Only the geometry changes. Revisit only if the filled mark reads too heavy once seen in place |
| 11 | Which documents are rewritten for "ring" → "ember centre"? | **Live documents plus the live ADR bodies**: the glossary rows and invariants 21 and 27, `.agents/skills/acidanthera-design/SKILL.md`, `doc/v0-spec.md`, `CONTRIBUTING.md`, `README.md`, the comments in `glyphs.tsx` and `HomeSurface.tsx`, **and the bodies of ADR 0122 and ADR 0129**. Left verbatim: ADR 0117 (superseded), every spec and plan, and the glossary Changelog | 0122 and 0129 are not superseded, so their text is still read as current, and "the ring renders wherever the mark renders" would describe a shape that no longer exists. This deliberately departs from the rebrand spec's decision 17, which left every ADR body verbatim |
| 12 | Fix the pre-existing drift found in files this work edits anyway? | **Fix both**: `CONTRIBUTING.md:91–92` (says the brand mark may not use ember — contradicts ADR 0122 since 2026-09-08) and `doc/v0-spec.md:166` (says the footer identity block carries Settings — the *theme toggle* took that slot; and says the rail pins Settings beneath its stack, where invariant 24 has `⚙` in the stack and the theme toggle `☀` as the bottom pin) | Leaving a contradiction beside a freshly updated line makes the stale line look current |
| 13 | Does *Brand mark* become a glossary term? | **Yes** — a new row in `.agents/ubiquitous-language.md` › Cross-cutting presentation vocabulary (see Glossary Changes); the rows that restate its definition reduce to a reference | The term is used by five rows and invariants 21, 27 and 30 yet defined by none, so each restates part of it |
| 14 | Palette of the fixed-ink assets (app icon, favicon, lockups) | **The tokens of the ground's theme**: hexagon `--text-primary` (`#ecedee` on a dark ground, `#26251e` on a light one); dot `--accent` (`#e8683a` on dark, `#f54e00` on light) | Each asset then shows the mark exactly as the app would draw it on that ground. The renders' own inks (`#ebeced`, `#29261d`, `#f75820`…) are these tokens plus noise |
| 15 | Format the README references for the lockup | **The two lockup SVG masters, directly**, in the existing `<picture>` light/dark switch. Lockups are horizontal (mark left, wordmark right, as renders 1 and 2), the wordmark in Geist Medium converted to outlines | GitHub renders an SVG crisply at any DPI on a transparent ground, and outlined text depends on no font. One file per variant, so no exported PNG to fall out of sync |
| 16 | Where does the icon regeneration command live? | A **`pnpm icons`** script in `package.json` running `tauri icon` on the app-icon master, listed in `AGENTS.md` › Commands | The last rebrand's exact command survived only in its spec and a gitignored `.worktrees/` issue file. A script documents itself for whoever next changes the master |
| 17 | Delivery | **One GitHub issue** | The pieces (mark + glyph + favicon; app icon; lockups + README + asset cleanup; docs and glossary) all hang off one geometry, so an epic would pay four reviews and four merges for little real parallelism. The previous rebrand shipped the same way (#134) |
| 18 | How do the mark's copies stay in sync? | **An equality test.** `glyphs.tsx` exports the mark's path `d` as a constant used by `AcidantheraMarkGlyph`; a Vitest test asserts that every SVG under `assets/brand/` and `public/brand/` contains exactly that `d`, each asset positioning it only with `transform` | The path lives in about six places (glyph, mark master, two lockups, app-icon master, favicon). A few lines of test catch the next hand edit to one copy; a generator script would be more tooling than a once-per-rebrand change warrants |

## Explicitly Out of Scope

- **Renaming or moving `AcidantheraMarkGlyph`** or `src/components/vault/glyphs.tsx`. Invariant 30
  names the component; the rebrand is not a refactor.
- **A small-size variant of the mark** (decision 2) — excluded again, as the first rebrand excluded it.
- **A brand typeface** (decision 7). Geist stays the only sans face.
- **macOS 26 Icon Composer assets** (`.icon`, dark/tinted icon variants). One dark squircle, as today.
- **Changing any placement's size** (decision 10), or adding a placement.
- **Rewriting historical records**: every file in `.agents/specs/` and `.agents/plans/`, the glossary
  Changelog's existing rows, and ADR 0117. Only ADRs 0122 and 0129 are amended (decision 11).
- **The accent system itself.** ADR 0105, ADR 0122's ruling (identity, not signal) and invariant 27's
  two colored fills are unchanged; only the word for the mark's ember element changes.
- **The wordmark's in-app rendering.** It stays live Geist text; no SVG wordmark in the app.

## Glossary Changes

Terms resolved during this session, as glossary rows ready to promote. They are **not** written
into the glossary now: a term enters when its code lands (ADR 0127), so the work that implements
this spec copies these rows across in the same commit that makes them true. Each row obeys the
600 B one-claim ceiling it will be held to there (`.agents/rules/domain-glossary.md`).

| Term | Canonical type | Aliases to avoid | Notes | Destination file |
|------|----------------|------------------|-------|------------------|
| Brand mark | `AcidantheraMarkGlyph` (`src/components/vault/glyphs.tsx`) | logo, app icon, orbit mark | The acidanthera identity: a filled hexagon with a six-point concave star knocked out and an *ember centre*, one geometry at every size. **Identity, not signal**: the accent system does not govern it, so the ember centre renders wherever the mark does; the exemption covers the mark, never a fill behind it (ADR 0122). The app icon and the lockups are assets built from it, not the mark itself. | `.agents/ubiquitous-language.md` › Cross-cutting presentation vocabulary |

Amendments promoted in the same commit (wording only; each row gets shorter or stays the same size):

- **Invariant 21** — "whose ring renders wherever the mark does" → "whose *ember centre* renders
  wherever the mark does".
- **Invariant 27** — "the brand mark's identity ring" → "the *brand mark*'s ember centre".
- **Sidebar rail** — drop "Its brand mark carries the ember ring (ADR 0122)."; italicise *brand mark*
  in the row's list.
- **Icon** — "That survivor is `AcidantheraMarkGlyph`, redrawn at the house stroke; it carries the
  ember ring wherever it renders, the mark being identity rather than signal (ADR 0122)." → "That
  survivor is the *brand mark*, filled rather than stroked: the house stroke governs icons, and the
  mark is not one."
- **AI accent** — "Exempt: the **brand mark**, identity not signal (ADR 0122)" → "Exempt: the
  *brand mark* (ADR 0122)".
- **Footer identity block**, **Home surface** — italicise *brand mark* as a term reference; no other
  change.

Then follow the post-edit procedure: set `Last updated` on `.agents/ubiquitous-language.md` and
`.agents/ubiquitous-language-invariants.md`, add a Changelog row, and regenerate
`.agents/ubiquitous-language-index.md`.

## ADRs Raised

None. Every decision here is reversed by editing an SVG or a sentence, so none passes the
"hard to reverse" test in `.agents/rules/adr.md`. The bodies of ADR 0122 and ADR 0129 are amended
in wording only (decision 11); neither ruling changes.

## Residual Unknowns

- **Outlining Geist Medium for the lockups.** The repo ships only `@fontsource-variable/geist`
  (a variable woff2); a static weight-500 instance is needed before the glyph outlines can be
  extracted — likely `fonttools` instancing, or the static Geist font. A tooling choice for the
  plan, low risk.
- **Final geometry tuning.** Decision 1's parameters are a measured starting point; the implementer
  may tune them within the renders' spread (tips 0.75–0.82R, arc depth 0.52–0.54R, dot 0.18–0.19R)
  if a side-by-side against renders (3) and (4) calls for it.
- **The current icon's finish, exactly.** Sampled so far from
  `assets/brand/source/acidanthera-transparent-icon-1024.png`: tile ≈ `#1b1b1b`–`#202020`, edge
  ≈ `#29282a`, transparent corners. Measure precisely (and the mark-to-tile proportion) before that
  file is deleted.
- **`tauri icon` and SVG filters.** If the soft shadow is an SVG filter, confirm `tauri icon`'s SVG
  rasteriser renders it; otherwise bake the shadow as geometry or opacity.
- **The standalone mark master's ink** — a plan-level choice within decision 14 (it is a geometry
  reference; embedding assets set their own ink).
- **Lockup proportions** (mark height relative to the wordmark, gap) — measure from renders (1)
  and (2).
