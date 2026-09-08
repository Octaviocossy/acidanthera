---
name: acidanthera-design
description: Use when writing or reviewing any UI in src/components or src/styles — picking a surface, text level, radius, or typeface, or deciding whether something may carry the ember accent. Encodes the acidanthera design system's rules.
---

# acidanthera Design System

Use the semantic tokens in `src/styles/tokens/`; do not introduce parallel values or Factory-era names.

## Surfaces, text, and borders

- Move through surfaces by depth: `--bg-canvas` is the editor canvas and the *inset card* fill; `--bg-panel` is for side panels and the gutter those cards sit in; `--bg-surface` is for raised chrome and modal bases; `--bg-elevated` is for active rows, chips, and tiles; `--bg-hover` is for hovered or selected overlay rows. The canvas is deliberately darker than the sidebar panel. There is no status surface and no title-bar surface — neither component exists (ADRs 0009, 0035).
- Use `--text-primary` for headings and active rows, `--text-body` for editor prose, `--text-secondary` for UI labels and inactive navigation, and `--text-muted` for metadata, hints, and section labels.
- Use `--border-hairline` for seams and dividers, `--border` for cards, inputs, and chips, and `--border-strong` for focused outlines and modal edges.

## Type and shape

- Geist is for UI chrome. JetBrains Mono is for document content and metadata.
- Use the semantic type scale from `typography.css`: micro, label, meta, caption, UI, body, input, h2, h1, and display. Headings stop at weight 500; reserve 600 for strong inline emphasis.
- Select radii by what the component wraps: `--radius-kbd`, `--radius-btn`, `--radius-item`, `--radius-tab`, `--radius-card`, `--radius-panel`, `--radius-modal`, or `--radius-pill`. Do not choose by an arbitrary small/medium/large label.

## Accent discipline

The ember accent means **the AI acted here** and nothing else (ADR 0007). It is permitted only for the primary nav's **Agent** `✦`, Send, the active model pill, a running tool chip, an agent-turn glyph, and a dirty-note dot — and, at disabled opacity, an AI action that is offered but not yet available. Do not use it for success, status, decoration, or large fills.

The **brand mark is exempt**: it is identity rather than signal, so the accent system does not apply to it at all, and its ember ring renders **wherever the mark renders** — the app icon, the favicon, the sidebar's brand row, the footer identity tile, and the collapsed rail (ADR 0036, which supersedes ADR 0032 and reverses ADR 0011 decision 16). The test is what the element *is*, not where it is drawn. The exemption covers the mark, never a fill behind it: the footer tile is `--bg-elevated`, never `--accent-soft`.

`--danger` is the only other colored fill in the system and marks the destructive path — the menu row that starts it and the button that commits it, nothing else (ADRs 0015, 0018). A failed operation stays monochrome. Diff add/delete colors remain a separate directional encoding.

## Iconography and voice

- Use the Unicode vocabulary for characters that live **inside text**: `✦` AI, `◈` context/file, `⌕` search, `＋` add, and `·` separator. These are typography, not an icon set; keep them as characters and do not substitute emoji.
- Every *drawn* icon comes from Lucide through the `Icon` primitive (ADR 0017), the only place `strokeWidth={1.2}` with `absoluteStrokeWidth` is set. Do not hand-write an SVG and do not set the stroke at a call site. `AcidantheraMarkGlyph` is the one hand-drawn survivor — a brand mark is not an icon. Disclosure (`▸`/`▾`) is a rotated Lucide chevron, not a character.
- Keep copy terse and lowercase-leaning. Use sentence case for labels and lowercase mono for metadata. Do not use emoji.

## Layout and chrome

- There is **no titlebar and no status bar**. The 40px top band is the *chrome strip*, which each region renders for itself; it carries no state and no controls (ADRs 0009, 0035). Every global control lives in the sidebar — the primary nav, the brand row, the footer identity block, or, while collapsed, the rail. New state goes on the surface that owns it; a shared bar is not an option.
- The **primary nav** is the one surface that renders a chord **persistently**, as an unboxed `Kbd` in the row rather than on hover. Everywhere else a chord is a hover reveal.
- Every user-facing chord is read from the resolved keymap (`formatChord` / `formatChords`, or the `useCommandChord` hook) and is **never** written as a string literal — not in copy, not in an `aria-label`. A literal is wrong the moment anyone edits `keymaps.toml`.
- A clipped surface carries a hover reveal, and inside the sidebar that reveal is the drawn `Tooltip` primitive, not a native `title` (ADR 0034).

## Motion and elevation

- Use 150ms fades only. Never bounce. Hover moves one surface step up.
- In dark mode, create hierarchy with hairline borders, not shadows, except for window and overlay drops. In light mode, shadows are warm and never cool-tinted.
- An **inset card** — the editor and the agent panel — is bounded by a hairline in **both** themes and **never** a shadow: it is set into the `--bg-panel` gutter, not raised above it. Its border steps to `--border-strong` on all four sides while its region is focused; that is how a focused region reads now that no edge is shared.
- Use the shared scrim without backdrop blur.

## In this repository

The authoritative token values live in `src/styles/tokens/` and Tailwind utility mappings live in `src/styles/index.css`; this skill deliberately carries rules rather than a copy of those values. `src/components/ui/` contains the store-free primitives `Button`, `Kbd`, `SectionLabel`, `Chip`, `Switch`, `Segmented`, `Modal`, `Icon`, and `Tooltip`. `Button` has `primary`, `danger`, `secondary`, and `ghost` variants; the two filled variants are the app's only colored buttons and never appear together. `Chip` is the only label-shaped primitive — the square label chip it replaced was deleted once it had no consumer, so a bordered mono label box is no longer part of the vocabulary. `Modal` is the one primitive with a side effect: it registers the modal keymap layer. `FileTreeItem` and `EditorTabs` are store-aware application components, not primitives.

Honor invariant 21: the AI accent marks AI agency and nothing else, with the brand mark exempt as identity rather than signal (ADR 0036) and the dirty-note dot as the one permitted status indicator. Honor invariant 22: acidanthera names are the only token vocabulary; Factory names and aliases no longer exist. Honor invariant 23: there is no status bar and no titlebar. Honor invariant 27: `--danger` marks the destructive path only, which together with invariant 21 leaves the app exactly two colored fills.
