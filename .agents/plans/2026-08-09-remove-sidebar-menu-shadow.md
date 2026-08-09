# Plan: Remove Sidebar Context Menu Shadow

> Status: **completed**
> Created: 2026-08-09
> Updated: 2026-08-09
> Spec: `.agents/specs/2026-08-09-sidebar-context-menu-elevation.md`

## Goal

Remove the overly strong shadow from the sidebar context menu so the existing border provides its
only elevation cue. Keep every menu action and interaction unchanged.

## Context

- `src/components/vault/SidebarContextMenu.tsx` renders the app-drawn menu established by the
  settled sidebar-context-menu spec.
- The menu panel currently combines `border-border-strong` with
  `shadow-[var(--shadow-overlay-dark)]`. That shared shadow is `0 24px 64px rgba(0, 0, 0, 0.5)`,
  which is too pronounced for this compact menu.
- The settled elevation adjustment specifies no shadow for this component. Orbit dark-mode guidance
  prefers hairline and strong borders for hierarchy, except where a drop shadow is genuinely needed.
- The change is intentionally local: dialogs and other overlays retain their existing elevation.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/vault/SidebarContextMenu.tsx` | Remove the menu panel's shadow utility class. |

## Step-by-Step Implementation

1. **Remove the context menu shadow utility.**
   - **File:** `src/components/vault/SidebarContextMenu.tsx`
   - **Action:** MODIFY
   - **Details:** On the positioned panel `div` with `role="menu"`, remove only
     `shadow-[var(--shadow-overlay-dark)]` from `className`. Preserve
     `absolute min-w-40 rounded-card border border-border-strong bg-elevated p-1`, the inline
     clamped-position style, the ARIA attributes, and all menu item markup and handlers.
   - **Why:** The existing strong border supplies the required separation without the excessive
     overlay drop shadow.

## Architecture Decisions

- Follow `.agents/specs/2026-08-09-sidebar-context-menu-elevation.md`: the shadow is removed rather
  than replaced with a new value or token.
- Keep this local to `SidebarContextMenu`; shared shadow tokens remain unchanged because dialogs and
  larger overlays may still require their established elevation.
- Do not add a visual-class assertion to the component tests. The change is a single presentational
  utility with no observable behavior change; existing interaction tests remain the appropriate
  regression coverage.

## Validation Criteria

- [ ] `pnpm check` passes.
- [ ] `pnpm build` passes.
- [ ] Open the sidebar context menu from a row and from the empty background; it retains its border,
  position, actions, and dismissal behavior without a drop shadow.
- [ ] Confirm dialogs and the file finder still retain their existing shadows.

## Open Questions

None.
