# Plan: Restyle app chrome (sidebar, status & command bars) to Factory

> Status: **approved**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #57

## Goal

Restyle the app's **instrument chrome** — the sidebar/vault tree, the status bar, the command
bar, and the toast host — to the Factory aesthetic: Geist Mono uppercase eyebrows, ash-stroke
hairline borders, obsidian wells, warm-granite muted text, and the terminal "instrument, not
marketing" voice. This is the layer that most embodies Factory's
Geist-Mono-12px-uppercase label discipline.

## Context

- **Current state:** After #56 (merged), these components already inherit Factory colors +
  Geist type through tokens. This slice refines them component-by-component so the chrome reads
  as a control surface: mono uppercase section labels, 1px `--color-ash-stroke` dividers, no
  shadows.
- **Depends on #56** (merged into `main`) for the token/font foundation and the restyled
  `ui/button`/`ui/badge`. Do not re-edit token files here.
- Read `.agents/ubiquitous-language.md` first. Glossary-tracked entities in scope: `sidebarOpen`,
  `FileTreeItem`, `EntryDraft`/`EntryDraftRow`, sidebar cursor/active states, `Toast`/`ToastHost`,
  `CommandBar`.
- This is Wave 2 of epic #55 ("adopt Factory design system") — see
  `.agents/plans/2026-07-10-epic-factory-design-system.md`. Siblings #58, #59, #60 touch
  disjoint files (see epic plan's File Ownership section) and run in the same wave.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/layout/Layout.tsx` | App shell grid — apply obsidian canvas, section rhythm, hairline region separators |
| MODIFY | `src/components/layout/StatusBar.tsx` | Mono uppercase status voice; ash-stroke top border; vim/region indicators |
| MODIFY | `src/components/layout/CommandBar.tsx` | Terminal command line — mono, carbon-lift well, hairline border |
| MODIFY | `src/components/layout/ToastHost.tsx` | Factory toast: hairline border, mono tag, monochrome tones (info/error by border weight, not color) |
| MODIFY | `src/components/layout/Sidebar.tsx` | Vault explorer — obsidian well, mono uppercase vault header/eyebrow, 24px rhythm |
| MODIFY | `src/components/vault/FileTreeItem.tsx` | Tree row — cursor (inset `--border-active` bar) + active (`--surface-2` raise) states in Factory tones |
| MODIFY | `src/components/vault/EntryDraftRow.tsx` | Inline draft input styled to match the Factory row |
| MODIFY | `src/components/vault/glyphs.tsx` | File/dir/chevron glyph strokes tuned to warm-granite / bone |

## Step-by-Step Implementation

1. **Layout shell** (`Layout.tsx`): ensure the canvas is `bg-bg` (obsidian) everywhere; separate
   the sidebar / viewer / chat rails with 1px `border-[var(--color-ash-stroke)]` dividers (no
   shadow). Keep the existing rail widths (`--rail-*`).
   - **Why:** establishes the flat hairline-separated shell every other component sits inside.
2. **StatusBar**: render labels in `font-mono` uppercase with `tracking-[var(--tracking-caps)]`,
   `text-text-dim` (warm granite) for inactive and `text-text` (bone) for active; top hairline
   `border-[var(--color-ash-stroke)]`; the sidebar/settings buttons use the restyled `Button`
   `quiet`/`ghost` variant from #56.
3. **CommandBar**: carbon-lift fill (`bg-surface`), hairline border, mono prompt glyph, bone
   caret/text; keep the `:`/Escape mode wiring untouched (styling only).
4. **ToastHost**: keep the monochrome tone discipline (info vs error differ by border weight + a
   mono tracked-caps tag, never color); hairline `--color-ash-stroke` border, `bg-surface`
   (carbon), mono tag, fade-only motion using the updated `--dur`/`--ease`.
5. **Sidebar**: the vault header/eyebrow becomes Geist Mono 12px uppercase (`text-text-dim`,
   `--tracking-caps`); the two create buttons use the `Button` `ghost` variant; obsidian well;
   24px vertical rhythm per Factory spacing.
6. **FileTreeItem**: keep the two selection states distinct — `cursor` = inset
   `--border-active` bar with no fill; `active` = raised `bg-surface-2`; labels in Geist (sans)
   not mono (these are content names, page voice); depth indents unchanged.
7. **EntryDraftRow**: the inline `<input>` inherits Geist, transparent fill, matches the row
   geometry; commit/cancel behavior unchanged.
8. **glyphs.tsx**: stroke colors keyed to `--text-dim`/`--text` (warm granite → bone); keep them
   hairline-thin to match the flat aesthetic.

## Architecture Decisions

- **Sans vs mono is semantic:** content (file names, note titles) uses Geist sans; instrument
  labels (status voice, section eyebrows, toast tags) use Geist Mono uppercase. Fix any spot
  currently using `font-mono` for a content name.
- **Styling only:** do not change keymap/focus/state logic (`useGlobalKeymap`,
  `useSidebarKeymap`, `useAppStore`) — this slice is purely presentational.
- No shadows anywhere; depth is hairline borders + `--surface`/`--surface-2` steps.

## Validation Criteria

- [ ] `pnpm check && pnpm build` pass.
- [ ] `pnpm dev`: sidebar, status bar, command bar, and toasts render in Factory tones with mono
      uppercase eyebrows and hairline borders; cursor vs active tree states remain visually
      distinct.
- [ ] No drop shadows introduced; info/error toasts still differ by border/tag, not color.

## Open Questions

- Whether the active tree row should use the bone "light card" figure/ground move or stay a
  subtle `--surface-2` raise. Default: subtle raise (a bright card per row would be noisy);
  reserve the bone card for the chat/empty-state surfaces.
