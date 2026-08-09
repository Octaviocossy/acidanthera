# Spec: Chrome Weight Pass — Chat Chips, Vim Mode, Sidebar Rail

> Status: **settled**
> Created: 2026-08-09
> Grilled: 2026-08-09 — 3 rounds, 10 decisions
> Suggested next: /create-issue

## Goal

Reduce the visual weight of four pieces of app chrome that read as oversized — the chat's
tool-call chip and model chip, the editor's vim-mode indicator, and the collapsed sidebar
rail's icon spacing — by fixing what actually causes the weight in each case.

## The finding that reframed the work

None of the three "too big" items was a font-size problem. Measured against the screenshot
at 1:1 CSS pixels:

| Surface | Font | Its neighbour | Real cause |
|---------|------|---------------|------------|
| `ToolChip` | 10.5px | message card 12.5px | `max-w-full` → **307px**, vs the card's 258px |
| Model `Chip` | 10.5px | Send button 11px | accent fill + `px-[10px]` → **93px**, wider than Send's 71px |
| Vim `Badge` | 10.5px | `ln · col` **11px** | a bordered box around text smaller than its unboxed neighbour |

All three sat *below* the text beside them. The weight came from width, fill, and a border
box — so all three fixes are structural, and only one moves a type step.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Tool chip — what is actually oversized | Vault-relative path **and** `max-w-[85%]` cap | Font was already the second-smallest step; `max-w-full` plus an absolute path is what stretched it to the panel edge |
| 2 | Model chip — which knob | `text-micro` + `px-2 py-[2px]`, accent kept | Brings it to ~70px, matching Send; ADR 0007 permits the active model pill's accent and nothing here overturns that |
| 3 | Vim mode — box or no box | Drop the box; bare `font-mono text-meta uppercase tracking-label text-text-muted` | Matches `ln · col` exactly, so the editor status cluster reads as one line of metadata rather than a readout beside a chip |
| 4 | Collapsed rail rhythm | `gap-2` (8px → 32px pitch) | The rail had *zero* gap; 8px between 24px targets is a calm rhythm without inflating hit targets or rail height |
| 5 | Tool-call path rule | Vault-relative → `displayPath` → raw; patterns untouched; **leading** ellipsis | `toolPath` can receive a grep regex, which has no relative form; clipping the *tail* hides the filename, which was the original defect |
| 6 | Chip: primitive or one call site | Change the `Chip` primitive | A per-site `className` override is exactly the drift a design system exists to prevent; `SettingsDialog` and `FileFinder` ride along by design |
| 7 | `Badge`'s fate | Delete it and its test | Dropping the box leaves it with zero consumers — verified single import, no barrel file |
| 8 | Rail grouping | `gap-2` within groups, 12px break before the root-entry list | Reproduces the expanded sidebar's header/tree separation with spacing rather than spending a hairline in a 40px column |
| 9 | Type tier: two steps or one | Leave `--font-size-label` at 10.5px | Collapsing the 0.5px gap touches five surfaces that were never complained about; it belongs in its own pass |
| 10 | `ToolChip`'s tier | `text-micro`, components stay separate | Both chat pills land on one tier without `Chip` absorbing a status glyph, a two-part body, and truncation logic |

## Explicitly Out of Scope

- **`--font-size-label` stays at 10.5px.** The 10 / 10.5px scale-step smell is real and
  survives this work as a known, separate cleanup (decision 9).
- **`SectionLabel`, the `CHAT`/`HISTORY` tab strip, `ChatHistoryList`'s empty states, and
  `ThinkingIndicator` are untouched.** Accepted consequence: `ThinkingIndicator` renders at
  10.5px in the same transcript column as 10px tool chips.
- **The ember accent is not removed from the model chip.** ADR 0007 lists the active model
  pill as a permitted carrier; only its size and padding change.
- **`ToolChip` is not folded into `Chip`.** Considered and rejected in decision 10 — the
  primitive would stop being a simple pill.
- **No change to the rail's contents, its launcher semantics, or its focus behavior.**
  ADR 0011 stands untouched; this is spacing only.
- **The model chip gains no dropdown caret.** Noticed during the grill, deliberately not
  bundled — it is an affordance change, not a weight change.

## Glossary Changes

Written inline to `.agents/ubiquitous-language.md` during the session:

- ***Editor status cluster*** — rewritten: the `EditorVimMode` renders as bare
  `--font-size-meta` mono metadata, with no box, border, or fill.
- **"Global versus editor Vim mode"** ambiguity — amended: nothing in the app renders a mode
  badge at all.
- ***Design primitive*** — `Badge` dropped from the list; the "`Badge` and `Chip` do not
  merge" sentence replaced, since a bordered mono label box is no longer in the vocabulary.
- ***Vault display path*** — narrowed to user-facing **absolute** paths; it is no longer
  "the single helper behind every user-facing path".
- ***Tool-call path*** — **new term**, defined beside it: the resolution order, the
  pattern exemption, and the leading-ellipsis rule.

## ADRs Raised

None.

Each decision is a one-line reversal, so none passes the "hard to reverse" test in
`.agents/rules/adr.md`. The two a future reader might question — the deleted primitive and
the leading ellipsis — are explained in the glossary, which is the right home for them.

## Residual Unknowns

None. The frontier emptied cleanly.
