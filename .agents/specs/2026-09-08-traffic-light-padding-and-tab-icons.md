# Spec: Traffic-light padding and always-on tab icons

> Status: **settled**
> Created: 2026-09-08
> Grilled: 2026-09-08 — 3 rounds, 10 decisions
> Suggested next: none — no handoff command applies. Decision 8 landed this directly on
> `147-reconcile-design-docs`, the open child of epic #141, rather than routing it to
> `/create-issue`.

## Goal

Move the native traffic lights off the window's left edge and onto the sidebar's own 14px
gutter, and give every editor tab its file icon rather than only the active one — two small
corrections to chrome the unified-sidebar epic (#141) has just landed.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Which axis gains the padding | Horizontal only — `trafficLightPosition.x`; the 40px band, `y: 21.5` and `--rail-titlebar` are untouched | The visible problem is the lights hugging the edge at 9px while every sidebar row starts at 14px. The vertical is already measured-centred in the band, and growing the band would reopen ADR 0121, both 40px literals, the sidebar strip and the *inset card*'s top geometry for a complaint nobody made |
| 2 | The new `x` value | **14** — the sidebar's own gutter (`px-[14px]`) | The only candidate that means something in this app rather than merely looking roomier: it makes the lights the first item in the column every sidebar row already starts in, so the brand mark below them shares one left edge. Also the smallest change that fixes the complaint (+5px). The macOS default of 20 was rejected for landing 6px inside that gutter, aligning with nothing |
| 3 | How `TRAFFIC_LIGHT_CLEARANCE` is re-derived | **Re-measured** from the running app after the config change, never derived from the shift | The glossary already records this number as "a measurement, never a derivation". The derivation has now been wrong twice — #131 assumed the `x` origin, #144 assumed 20px button spacing and landed 6px short. Arithmetic predicts 87; the pinned value is whatever the screenshot says |
| 4 | Whether anything moves with the lights | Nothing — the sidebar gutter, brand row and rail glyph column stay exactly where they are | Under decision 2 the lights move *to* the existing gutter, so the alignment is achieved by moving one thing rather than four. A sidebar edit here would be a second, unrelated design change riding along |
| 5 | Tab icon visibility | Every tab chip carries its `FileText` icon, active or not — **reversing the icon clause of the unified-sidebar spec's decision 42** | An icon that appears only on the active chip changes that chip's *width* on activation, so the whole strip reflows on every tab switch — a worse noise problem than the one decision 42 set out to solve. A persistent icon also gives each chip a stable left edge. Decision 42's quieting rationale was about the always-visible `×`, not the icon |
| 6 | The inactive icon's colour | Inherits the chip's `text-text-muted`, exactly as the label does | Active/inactive is already carried by the label colour, the `bg-canvas` fill and the hairline; a separate icon-colour rule would be a fourth encoding of one bit, and inheriting keeps `Icon`'s `currentColor` contract untouched |
| 7 | Whether the `×` reveal survives | Yes — the close button stays hover-only on inactive tabs | That is the half of decision 42 its own rationale actually supports: a permanent `×` per open buffer was the noise being removed, and it is unaffected by the icon question |
| 8 | Where the work lands | Spec, glossary, config, component and test all on `147-reconcile-design-docs`, with `/update-issue` so #147 stops disagreeing with its branch | The user's call, taken against the recommendation to hold it for a follow-up issue off `main`. The measurement in decision 3 couples the glossary to the code in one direction — there is nothing to measure until `x: 14` ships — so splitting them would force either an unverified number in the glossary or a stated-nowhere clearance |
| 9 | #147's review gate | The branch is re-reviewed after the addition; the gate then decides on what will actually integrate | Invariant 44 — work is not done until an agentic review has seen it. Every other child of #141 went through exactly this, and the existing report predates these files |
| 10 | Whether either change warrants an ADR | No | Both fail `adr.md`'s hard-to-reverse test — a one-number config edit and a one-line diff — and neither displaces a competing mechanism. Decision 5 does reverse a recorded decision, but a reversal of a per-task spec decision belongs in this table, not an ADR (the reasoning already recorded for the accent-in-chrome rule under ADR 0105) |

## Explicitly Out of Scope

- **A taller chrome strip.** The 40px band stays; `y: 21.5` and `--rail-titlebar` are not touched (decision 1).
- **Moving the sidebar's gutter, brand row or rail glyph column** to meet the lights (decision 4).
- **A permanently visible `×`** on inactive tabs (decision 7).
- **A per-source tab icon** — a config buffer keeps `FileText` like every other tab; varying the glyph by `EditorBufferSource` was not asked for and is not decided here.
- **Any change to the chip's `gap-2` / `px-[14px]` metrics** — the icon slots into the spacing that already exists.

## Glossary Changes

Two rows in `.agents/ubiquitous-language.md`, both amended **after** the measurement (decision 3):

- *Traffic light inset* — the measured button geometry, which the `x` change invalidates.
- *Chrome strip* — the `TRAFFIC_LIGHT_CLEARANCE` figure derived from that geometry.

The tab icon needs no glossary change: no row states which chips carry one.

## ADRs Raised

None. See decision 10.

## Residual Unknowns

None. The one open number — the measured zoom-button right edge, and the clearance built from
it — is a fact to be gathered by decision 3's procedure, not a decision left unsettled.
