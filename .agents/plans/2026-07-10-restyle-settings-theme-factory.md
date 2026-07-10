# Plan: Restyle settings dialog & theme application to Factory

> Status: **approved**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #60

## Goal

Restyle the Settings dialog to Factory (flat modal, hairline borders, mono field labels, no
shadow) and reconcile theme/font application with the new system: the dark + light toggle now
switches between the Factory-pure dark palette and the Factory-derived light mirror, and the
font setting defaults to Geist. Confirm `useApplyTheme` still drives `data-theme` and
`--editor-font` correctly against the #56 tokens.

## Context

- **Current state:** `SettingsDialog` is a modal editing four persisted settings (`model`,
  `editorFont`, `theme`, `vaultPath`) via `useSettingsStore.updateSettings`; keystrokes inside
  stop propagation so the global keymap never fires under it. `useApplyTheme` sets `data-theme`
  from `settings.theme` and `--editor-font` from `settings.editorFont`, reactive to the settings
  store. Both dark + light are retained (product decision).
- **Depends on #56** (merged into `main`) for tokens/fonts and the restyled `Button`. Do not edit
  token files.
- Read `.agents/ubiquitous-language.md` first. Glossary-tracked: `SettingsDialog`,
  `settingsOpen`, `useApplyTheme`, `--editor-font`, `Settings` (`theme` = `ThemeName`
  `dark|light`), `AgentModel` catalog.
- This is Wave 2 of epic #55 ("adopt Factory design system") — see
  `.agents/plans/2026-07-10-epic-factory-design-system.md`. Siblings #57, #58, #59 touch
  disjoint files and run in the same wave.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/layout/SettingsDialog.tsx` | Factory modal: obsidian/carbon panel, hairline `--color-ash-stroke` border, mono uppercase field labels, `--radius-lg` (10px), no shadow; scrim as flat obsidian wash |
| MODIFY | `src/hooks/use-apply-theme.ts` | Ensure `data-theme` dark/light maps onto the Factory palettes; default `--editor-font` to Geist Mono when `settings.editorFont` is unset |

## Step-by-Step Implementation

1. **SettingsDialog** (`SettingsDialog.tsx`): panel = `bg-surface` (carbon-lift) on a flat
   obsidian scrim (`bg-bg/…`, no blur), `border-[var(--color-ash-stroke)]`, `--radius-lg`,
   **no box-shadow** (Factory elevation = contrast, not depth). Section/field labels become
   Geist Mono 12px uppercase `text-text-dim` with `--tracking-caps`; values/inputs in Geist sans.
   The theme row keeps the dark/light choice; the model row unchanged in behavior (still calls
   `useChatStore.setModel`). Use the restyled `Button` (`ghost`/`light`) for actions. Preserve
   the stop-propagation + Escape/scrim-close behavior.
2. **use-apply-theme.ts**: verify `data-theme="light"` selects the Factory light mirror from #56
   and the attribute-less default is Factory dark (no code change may be needed beyond
   confirming token names). For `--editor-font`: keep applying `settings.editorFont` when set,
   but the fallback should now resolve to Geist Mono via `--font-mono` (the token default from
   #56) — ensure no stale JetBrains Mono literal remains here.
3. If the font picker enumerates specific families, add "Geist Mono" (and optionally "Geist") to
   the options and make Geist Mono the default label; keep the raw-string escape hatch if one
   exists.

## Architecture Decisions

- **Theme stays a persisted toggle.** Both Factory palettes are shipped; Settings switches them
  live via `useApplyTheme` — no `prefers-color-scheme`.
- **Flat modal.** No shadow/blur on the dialog; separation is the hairline border + the scrim's
  contrast, matching Factory's no-elevation rule.
- **Mono labels, sans values** — the same instrument/content voice split as the rest of the
  chrome.
- Styling + the font-default reconciliation only; no settings persistence/schema changes
  (`Settings` shape and `settingsService` unchanged).

## Validation Criteria

- [ ] `pnpm check && pnpm build` pass.
- [ ] `pnpm dev`: opening Settings shows a flat Factory modal (hairline border, no shadow, mono
      labels); switching theme flips the whole app between Factory dark and Factory light live;
      changing the font applies to the editor live.
- [ ] Default editor font resolves to Geist Mono; no JetBrains Mono literal remains in
      `use-apply-theme.ts`.

## Open Questions

- Whether to expose "Geist" (sans) as an editor-font option or keep the editor mono-only.
  Default: offer Geist Mono as default, keep the free-text escape hatch; editor is an instrument
  surface so mono is the intended face.
