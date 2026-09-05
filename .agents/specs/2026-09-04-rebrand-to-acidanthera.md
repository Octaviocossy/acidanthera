# Spec: Rebrand to `acidanthera`

> Status: **settled**
> Created: 2026-09-04
> Grilled: 2026-09-04 — 4 rounds, 18 decisions
> Suggested next: /create-issue

## Goal

Rename the product from `orbit-111` to `acidanthera` and adopt the supplied brand assets, all
the way down — display strings, package and crate identity, the bundle identifier, the on-disk
vault namespaces, and the internal code vocabulary — while keeping the two committed colour
invariants intact and leaving every historical record verbatim.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Name and written form | **`acidanthera`**, lowercase everywhere user-facing; `Acidanthera` only sentence-initial. `-111` dropped entirely | Matches the lockup and the existing lowercase `orbit` house style in the titlebar. `-111` disambiguated a name that no longer needs it |
| 2 | Rename depth | **All four layers**: display strings, package/crate identity, bundle identifier, on-disk vault namespaces, internal code vocabulary | A partial rename leaves the product's own name contradicting itself across layers a reader moves between freely |
| 3 | The mark's ember ring vs. invariant 21 | Ember on the **app icon and favicon only**; every in-app rendering monochrome. Invariant 21 gains one clause; ADR 0007 stands | Amending ADR 0007 was the alternative and was rejected: the *chat toggle*'s ember only pays while it is the sole accent pixel in chrome, which was the whole argument for putting it there. See ADR 0032 |
| 4 | How the identity renders in-app | Hand-drawn SVG mark (`AcidantheraMarkGlyph`) + the word in **Geist**, no bundled brand typeface | No font dependency, no raster in chrome, and ADR 0017's single-hand-drawn-exception shape is preserved rather than widened |
| 5 | Mark fidelity | **Faithful trace** — all six concave arcs and the centre ring | Chosen over a simplified silhouette; the detail is the mark |
| 6 | Mark render size | **24 × 28px hardcoded**, both call sites (`Sidebar.tsx:91` rail, `:226` header) | 24px is the box every rail and header button already uses, so the column's rhythm is preserved. At that size the arc-to-edge gap is 1.58px and the ring hole 2.50px — both above one stroke width, so every stroke reads separately. At today's 15px the gap is 0.99px, *narrower than the 1.2px stroke*, and the strokes merge |
| 7 | Mark construction | Reconstructed as **stroked geometry** at 1.2px `absoluteStrokeWidth`; six circular arcs bowing inward from the hexagon edges, meeting at its vertices. Non-square viewBox (source bbox 490 × 574, ratio 1.171) | An autotrace yields *filled* paths, which cannot carry `strokeWidth`/`absoluteStrokeWidth` — so tracing is not merely worse here, it is unavailable |
| 8 | Lockup background removal | **Soft luma-key** to alpha with a ramp | Both files are RGB with no alpha and *non-flat* backgrounds (dark #040405–#050507, light #FAF8F5–#FDFBF8) with soft glowing stroke edges. A flat-colour key halos and eats the antialiasing |
| 9 | Asset home | `public/brand/favicon.svg` (ships) + **`assets/brand/`** for the keyed lockups and the retained sources (repo-only) | `public/` is Vite's static root, so everything in it lands in `dist/`. ~3MB of source art that nothing loads at runtime should not ship |
| 10 | App icon source | **`pnpm tauri icon`** from `acidanthera-transparent-icon-1024.png`, regenerating all 17 files | One source, every platform size including the 11 Windows `Square*` files. The baked squircle is correct for macOS, which expects an icon to carry its own shape |
| 11 | Favicon | New **SVG favicon from the mark, ember included**; `vite.svg` and `tauri.svg` deleted | `index.html:5` still ships Vite's template logo on a live surface. Ember-bearing is the consistent reading of ADR 0032 — the test is "never renders inside the window", which a favicon passes exactly as the app icon does. A favicon cannot inherit `currentColor`, so it needs fixed ink |
| 12 | README hero | **Both keyed lockups** via `<picture>` / `prefers-color-scheme`; the now-redundant `<h1>` drops | This is why keying both variants matters — one lockup sits wrong in one of GitHub's two themes |
| 13 | App-config dir migration | **None in code** — `mv` `settings.toml` and `keymaps.toml` by hand, documented as a step | Nothing has shipped, so exactly one machine in the world has an old dir. A boot-time migration added for it is dead code on every clone forever |
| 14 | Chat storage and marker | `.orbit/chats/` → `.acidanthera/chats/` and `<!-- orbit:chat -->` → `<!-- acidanthera:chat -->`, with a **one-off `mv` + `sed`** over the local vault and **no back-compat code** | Same reasoning as #13, for 6 files on one machine. `parseChatFile` finding no markers returns an *empty transcript* rather than erroring, so a hard cut fails silently — hence the migration is mandatory, not optional. `CHAT_FILE_SCHEMA` is where a real compatibility story would live. See ADR 0033 |
| 15 | Default vault directory | `orbit-brain` → **`acidanthera-brain`** | Keeps the "brain" metaphor, which is doing real work in the name. First-run default only — an existing vault's absolute path lives in `settings.toml` and is untouched |
| 16 | The design system's name | **`acidanthera-design`** — skill directory, symlink and `name:` frontmatter move together; `--ease-orbit` → `--ease-acidanthera`; invariant 22 reworded, still citing ADR 0006 as its origin | Matches the repo's topic-named skill style (`rust-best-practices`, `tauri-v2`). A design system named after the old product inside a renamed app is exactly the drift the glossary exists to prevent |
| 17 | Historical records | **Left verbatim** — ADR bodies and slugs, `.agents/plans/`, `.agents/specs/`, the glossary Changelog | That is what was true when they were written, and one of them names a git branch (`epic/102-orbit-design-system`) that actually existed. `adr.md` frames an ADR as recording *that* a decision was made; rewriting one falsifies the record. Accepted consequence: `grep -i orbit` still hits `.agents/`, deliberately |
| 18 | Repo and URLs | Renamed to **`acidanthera`** on GitHub; remote plus all four URL strings (`package.json` repository/homepage/bugs, `Cargo.toml` repository) updated | GitHub redirects the old path indefinitely, so nothing breaks. `Octaviocossy/acidanthera` is a *user* repo and does not collide with the `acidanthera` org |

### Known collision, accepted

`github.com/acidanthera` is an established macOS-ecosystem organisation (OpenCore, Lilu,
VirtualSMC, WhateverGreen, AppleALC) — the same platform this app targets (macOS-only, ADR
0008). The collision is adjacency, not confusion of function: a notes app against a bootloader
and kext-patching suite. Proceeding knowingly.

## Explicitly Out of Scope

- **Any back-compat code for the renamed on-disk format.** No dual-marker read in
  `parseChatFile`, no `.orbit/chats/` fallback in `chats.rs`, no boot-time config-dir
  migration. Migration is a one-time manual step, not a permanent code path.
- **Rewriting historical records.** ADR bodies and slugs, `.agents/plans/`, `.agents/specs/`
  and the glossary Changelog keep saying "orbit".
- **Bundling a brand typeface.** The wordmark renders as Geist text in-app.
- **A simplified small-size mark variant**, and any optical-sizing scheme. One traced glyph at
  one hardcoded size.
- **Renaming any existing vault directory.** Decision 15 changes a first-run default only; a
  vault already in use keeps its name, because its absolute path is what `settings.toml` holds.
- **The `com.ovct.` identifier prefix**, which stays as-is.
- **Retiring `--ease-*` as a concept.** The alias is renamed, not reconsidered — a
  product-neutral token name was offered and declined.

## Glossary Changes

Written inline during the session, under the marker now carried by the *Cross-cutting
presentation vocabulary* section:

- ***AI accent*** — the app-icon/favicon exception added, with the "never renders inside the
  window" test stated as what draws the boundary. ADR 0011 decision 16's reference generalised
  from "the orbit mark" to "the brand mark".
- **Invariant 21** — same exception, citing ADR 0032; `AcidantheraMarkGlyph` named as
  monochrome.
- ***Icon*** row and **invariant 30** — the sole hand-drawn survivor renamed
  `OrbitMarkGlyph` → `AcidantheraMarkGlyph`.
- `Last updated` bumped to 2026-09-04; a Changelog row added.

**Deliberately deferred to the implementation, not written now:** the mechanical
`orbit` → `acidanthera` pass over the remaining live rows (*titlebar*, *sidebar rail*, *chat
persistence store*, *chat file*, invariant 22, and the `.orbit/chats/` references). These are
one find-and-replace driven by decision 2, and applying half of it now would leave the document
internally inconsistent — invariant 22 reading "acidanthera token names" while the *surface
ladder* row still reads "Orbit token names". It lands with the code, under the same marker.

## ADRs Raised

- `.agents/adr/0032-app-icon-is-not-app-chrome.md` — the ember exception, with ADR 0007 left
  standing
- `.agents/adr/0033-rename-reaches-the-on-disk-format.md` — why a cosmetic rename changed a
  serialized marker, and what undoing it would cost

## Residual Unknowns

None. The frontier emptied cleanly.

Two items are manual steps outside the repository and must be called out in the issue rather
than assumed: renaming the repo on GitHub (decision 18, to be done *after* the issue is
created, so `/create-issue` parses the remote it is working against), and the two one-time
local migrations (decisions 13 and 14).
