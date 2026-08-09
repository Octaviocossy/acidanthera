# Spec: Sidebar Context Menu Elevation

> Status: **settled**
> Created: 2026-08-09
> Grilled: 2026-08-09 — 1 round, 1 decision
> Suggested next: /planning

## Goal

Remove the excessive visual elevation from the sidebar context menu while retaining the menu's
current layout and behavior.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Sidebar context menu elevation | Remove the panel shadow and retain its existing strong border | The dark-mode system favors borders for hierarchy; the menu already has `border-border-strong`, so the `--shadow-overlay-dark` drop is unnecessary. |

## Explicitly Out of Scope

- Changing the elevation of dialogs, the file finder, or any other overlay.
- Adding, changing, or removing shadow design tokens.
- Changing the context menu's position, dimensions, surface, border, actions, or interaction behavior.

## Glossary Changes

None.

## ADRs Raised

None.

## Residual Unknowns

None.
