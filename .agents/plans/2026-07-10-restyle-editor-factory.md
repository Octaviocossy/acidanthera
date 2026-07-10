# Plan: Restyle editor surface to Factory

> Status: **approved**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #59

## Goal

Restyle the CodeMirror 6 editor surface to Factory: the editor face becomes **Geist Mono** (the
terminal voice for the note buffer), wikilinks and the vim-mode badge adopt Factory tones, and
the `Viewer` chrome matches the obsidian canvas. Keep both the dark and light CM6 themes in sync
with the Factory palettes from #56.

## Context

- **Current state:** `src/lib/editor/theme.ts` is an `editorTheme(dark)` factory consuming Orbit
  tokens + `--editor-font`; `wikilink.ts` decorates `[[links]]` (underline + hover, no color);
  `Viewer.tsx` selects `settings.theme` to rebuild the CM6 base theme (memoized) and shows a
  vim-mode badge. After #56 (merged), `--editor-font` defaults to Geist Mono via `--font-mono`.
- **Depends on #56** (merged into `main`) for tokens/fonts. Do not edit token files.
- Read `.agents/ubiquitous-language.md` first. Glossary-tracked: `editorTheme`/`--editor-font`,
  `wikilink`, `EditorVimMode`, `Viewer`, `regionExit`.
- This is Wave 2 of epic #55 ("adopt Factory design system") — see
  `.agents/plans/2026-07-10-epic-factory-design-system.md`. Siblings #57, #58, #60 touch
  disjoint files and run in the same wave.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/lib/editor/theme.ts` | Rebuild the CM6 theme from Factory tokens (obsidian bg, bone text, ash selection/cursor); Geist Mono face; dark+light variants |
| MODIFY | `src/lib/editor/wikilink.ts` | Wikilink decoration in Factory (underline + warm-granite→bone hover, still no chromatic color) |
| MODIFY | `src/components/layout/Viewer.tsx` | Viewer chrome + vim-mode badge in Factory tones; obsidian canvas |

## Step-by-Step Implementation

1. **theme.ts**: map the CM6 `EditorView.theme` colors to Factory: background `--bg` (obsidian) /
   bone text `--text`; gutter + line-number in warm-granite `--text-dim`; active line a subtle
   `--surface`/`--surface-2` step; selection + cursor in ash/graphite; matching-bracket in a
   restrained tone. Font-family reads `var(--editor-font)` (now Geist Mono). Keep the
   `(dark: boolean)` factory signature so `Viewer`'s light/dark switch keeps working; produce a
   light variant that reads off the Factory light palette. No shadows/glows.
2. **wikilink.ts**: keep the decoration chromatic-free per the design system — underline in
   `--text-dim`, hover shifts to bone `--text` (never orange/green; wikilinks are content, not
   data-voice). Adjust any hardcoded color to a token.
3. **Viewer.tsx**: obsidian canvas behind the editor; the vim-mode badge (bottom-right) becomes a
   Factory mono uppercase tag — `text-text-dim`, `--tracking-caps`, hairline
   `--color-ash-stroke`, `--radius-sm`, no fill (or carbon-lift fill); keep it clear of the
   top-right `AiFab`. Preserve the memoization of `editorTheme(dark)` (extension identity only
   changes on a real theme switch).

## Architecture Decisions

- **Editor = mono voice.** The note buffer is an instrument surface, so Geist Mono is correct
  here even though body copy elsewhere is Geist sans.
- **Wikilinks stay monochrome.** They are content links, not status — the two accents are
  reserved for data-voice; a colored wikilink would break the accent discipline.
- Keep the `(dark)` theme factory + memoization contract intact so the Settings theme toggle
  (child #60) keeps switching editor themes live.
- Styling only — no editor behavior, vim, or `regionExit` keymap changes.

## Validation Criteria

- [ ] `pnpm check && pnpm build` pass.
- [ ] `pnpm dev`: the editor renders in Geist Mono on obsidian with bone text; wikilinks
      underline and hover to bone without color; the vim-mode badge is a Factory mono tag.
- [ ] Toggling `data-theme` light/dark (via Settings) switches the CM6 theme to the matching
      Factory palette with no stale colors.

## Open Questions

- Active-line treatment (`--surface` vs `--surface-2`) is an eyeball call for reading comfort;
  keep it subtle.
