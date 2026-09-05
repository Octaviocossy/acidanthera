---
name: acidanthera-design
description: Use when writing or reviewing any UI in src/components or src/styles — picking a surface, text level, radius, or typeface, or deciding whether something may carry the ember accent. Encodes the acidanthera design system's rules.
---

# acidanthera Design System

Use the semantic tokens in `src/styles/tokens/`; do not introduce parallel values or Factory-era names.

## Surfaces, text, and borders

- Move through surfaces by depth: `--bg-canvas` is the editor canvas and window base; `--bg-panel` is for side panels and status; `--bg-surface` is for title bars and modal bases; `--bg-elevated` is for active rows, chips, and cards; `--bg-hover` is for hovered or selected overlay rows. The canvas is deliberately darker than the sidebar panel.
- Use `--text-primary` for headings and active rows, `--text-body` for editor prose, `--text-secondary` for UI labels and inactive navigation, and `--text-muted` for metadata, hints, and section labels.
- Use `--border-hairline` for seams and dividers, `--border` for cards, inputs, and chips, and `--border-strong` for focused outlines and modal edges.

## Type and shape

- Geist is for UI chrome. JetBrains Mono is for document content and metadata.
- Use the semantic type scale from `typography.css`: micro, label, meta, caption, UI, body, input, h2, h1, and display. Headings stop at weight 500; reserve 600 for strong inline emphasis.
- Select radii by what the component wraps: `--radius-kbd`, `--radius-btn`, `--radius-item`, `--radius-tab`, `--radius-card`, `--radius-panel`, `--radius-modal`, or `--radius-pill`. Do not choose by an arbitrary small/medium/large label.

## Accent discipline

The ember accent means **the AI acted here** and nothing else (ADR 0007). It is permitted only for the FAB glyph, Send, the active model pill, a running tool chip, an agent-turn glyph, and a dirty-note dot. Do not use it for success, status, branding, decoration, or large fills — with one exception (ADR 0032): an icon that never renders inside the window, namely the app icon and the favicon, keeps its ember ring. Every in-app rendering of the brand mark stays monochrome. Diff add/delete colors remain a separate directional encoding.

## Iconography and voice

- Use the Unicode vocabulary: `✦` AI, `◈` context/file, `⌕` search, `▸`/`▾` disclosure, `＋` add, and `·` separator. Do not add an icon dependency or substitute emoji.
- Drawn icons use a 16 viewBox, render at 15px, use a 1.2 stroke, and inherit `currentColor`.
- Keep copy terse and lowercase-leaning. Use sentence case for labels and lowercase mono for metadata. Do not use emoji.

## Motion and elevation

- Use 150ms fades only. Never bounce. Hover moves one surface step up.
- In dark mode, create hierarchy with hairline borders, not shadows, except for window and overlay drops. In light mode, shadows are warm and never cool-tinted.
- Use the shared scrim without backdrop blur.

## In this repository

The authoritative token values live in `src/styles/tokens/` and Tailwind utility mappings live in `src/styles/index.css`; this skill deliberately carries rules rather than a copy of those values. `src/components/ui/` contains the store-free primitives `Kbd`, `SectionLabel`, `Chip`, `Switch`, and `Segmented`, plus `Button` and `Badge`. `FileTreeItem` and `EditorTabs` are store-aware application components, not primitives.

Honor invariant 21: the AI accent marks AI agency and nothing else, except the app icon and favicon (ADR 0032). Honor invariant 22: acidanthera names are the only token vocabulary; Factory names and aliases no longer exist.
