# Plan: Apply theme & editor font settings

> Status: **completed**
> Created: 2026-07-09
> Updated: 2026-07-09
> Issue: #28

## Goal

Make the persisted `settings.theme` (`'dark' | 'light'`) and `settings.editorFont` actually
take effect in the running app — a light token palette applied via a `data-theme` attribute,
and the editor's font family driven by an `--editor-font` CSS variable.

## Context

- Child #28 of epic #24 (`.agents/plans/2026-07-09-epic-settings-ux.md`), wave 2, depends on
  #25 (settings foundation — merged) and #26 (editor line numbers — merged).
- Note: the GitHub issue body was unreachable from the headless runner (private repo, no
  GitHub access by design — same situation as #25's run), so this plan was reconstructed
  from the epic plan's goal ("dark/light theme", "editor font" settings) and the settings
  foundation's explicit hand-off: "Theme/font are **stored but not yet applied** — that
  is #28" (`.agents/plans/2026-07-09-settings-foundation.md`, ubiquitous-language `Settings`
  entry).
- Today: every color in the app flows through the Orbit tokens on `:root`
  (`src/styles/tokens/colors.css`) — components, the shadcn semantic layer, and the CM6
  `editorTheme` all read `var(--*)`. There is exactly one palette (dark) and the editor font
  is hard-wired to `var(--font-mono)`. No TS/TSX file hard-codes a hex color (verified by
  grep), so flipping the token values flips the whole app.
- The settings dialog UI is #29 — this slice only wires application, verifiable by
  hand-editing `settings.json`.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/styles/tokens/colors.css` | Add `:root[data-theme='light']` palette + `color-scheme` on both palettes |
| MODIFY | `src/styles/tokens/typography.css` | Add `--editor-font` (defaults to `var(--font-mono)`) |
| MODIFY | `src/styles/index.css` | Update the now-stale "dark-only" comments |
| CREATE | `src/hooks/use-apply-theme.ts` | Hook applying `settings.theme` → `data-theme` attr and `settings.editorFont` → `--editor-font` var |
| MODIFY | `src/App.tsx` | Mount `useApplyTheme()` |
| MODIFY | `src/lib/editor/theme.ts` | `editorTheme(dark)` factory; font from `var(--editor-font)` |
| MODIFY | `src/components/layout/Viewer.tsx` | Memoize extensions on theme so CM6's `dark` flag follows settings |
| MODIFY | `src/services/settings.service.ts` | Update "#28 will apply" doc comments |
| MODIFY | `.agents/ubiquitous-language.md` | New entries + changelog row |

## Step-by-Step Implementation

> **Step 1 — Light palette tokens**
>
> - **File:** `src/styles/tokens/colors.css`
> - **Action:** MODIFY
> - **Details:** Keep `:root { ... }` (dark) as the default so nothing changes before
>   settings load; add `color-scheme: dark` to it. Add a `:root[data-theme='light']` block
>   overriding the same ten tokens with a monochrome zinc mirror of the dark ramp
>   (bg `#fafafa`, surface `#f4f4f5`, surface-2 `#e9e9eb`, border `#dcdce0`, border-active
>   `#b4b4bc`, text `#1b1b1f`, text-dim `#6b6b74`, text-faint `#b0b0b8`) plus a
>   contrast-corrected lime pair (`--fab-accent: #4d7c0f`, `--fab-accent-dim: #bef264`) and
>   `color-scheme: light`. Every consumer (Tailwind `@theme` mappings, shadcn layer, CM6
>   theme) already reads these vars, so no component changes are needed for color.
> - **Why:** token-level theming is the only mechanism consistent with the vendored design
>   system; the attribute selector keeps dark as the no-JS/boot default.

> **Step 2 — `--editor-font` variable**
>
> - **File:** `src/styles/tokens/typography.css`
> - **Action:** MODIFY — add `--editor-font: var(--font-mono);` to `:root`.
> - **Why:** the editor needs a settings-driven font slot with a sane default before
>   settings resolve; the chrome deliberately stays on `--font-mono` (the setting is the
>   *editor* font).

> **Step 3 — Theme-application hook**
>
> - **File:** `src/hooks/use-apply-theme.ts`
> - **Action:** CREATE
> - **Details:** `useApplyTheme()` — two `useEffect`s over `useSettingsStore` selectors:
>   - `theme`: `document.documentElement.dataset.theme = theme` (skip while `settings` is
>     `null` so the CSS default holds — no flash of wrong theme logic).
>   - `editorFont`: `document.documentElement.style.setProperty('--editor-font',
>     `${JSON.stringify(editorFont)}, var(--font-mono)`)` — `JSON.stringify` quotes/escapes
>     the family name; composing with `var(--font-mono)` keeps the JetBrains Mono stack as
>     fallback. Skip when empty/unset.
>   Reactive by construction: #29's dialog writes through `useSettingsStore.updateSettings`,
>   which updates the store optimistically, so this hook re-fires live.
> - **Why:** mirrors the repo's "hook mounted once in `App.tsx`" pattern
>   (`useSaveLoop`, `useSettingsBootstrap`); stores stay UI-agnostic.

> **Step 4 — Mount the hook**
>
> - **File:** `src/App.tsx`
> - **Action:** MODIFY — call `useApplyTheme()` alongside the existing hooks.

> **Step 5 — CM6 theme follows the setting**
>
> - **Files:** `src/lib/editor/theme.ts`, `src/components/layout/Viewer.tsx`
> - **Action:** MODIFY
> - **Details:**
>   - `theme.ts`: hoist the style spec to a module const; export
>     `editorTheme(dark: boolean)` returning `EditorView.theme(SPEC, { dark })`. Change
>     `.cm-content`/`.cm-scroller` `fontFamily` to `var(--editor-font)`.
>   - `Viewer.tsx`: rename the module-level array to `BASE_EXTENSIONS` (everything except
>     the theme); select `theme` from `useSettingsStore` (default `'dark'`);
>     `const extensions = useMemo(() => [...BASE_EXTENSIONS, editorTheme(theme === 'dark')], [theme])`.
>     Base extension instances stay module-level so vim/state fields survive the
>     reconfigure; the array identity only changes on an actual theme switch.
> - **Why:** colors already flow through CSS vars, but CM6's `dark` flag selects its
>   base-theme defaults (`&light`/`&dark` selectors) — it must track the active theme.

> **Step 6 — Comment + glossary hygiene**
>
> - **Files:** `src/styles/index.css`, `src/services/settings.service.ts`,
>   `.agents/ubiquitous-language.md`
> - **Action:** MODIFY — reword the "dark-only / #28 will apply" comments; add
>   `useApplyTheme` + light-palette notes to the glossary, update the `Settings` entry,
>   bump "Last updated", add a changelog row.

## Architecture Decisions

- **`data-theme` attribute over a `.dark`/`.light` class:** matches how the tokens are
  declared (on `:root`), keeps dark as the default when the attribute is absent (boot,
  tests), and stays orthogonal to Tailwind's class-based dark variant (unused here).
- **Token override block, not a second stylesheet:** the design system is "one set of token
  names, N palettes"; every consumer keeps reading the same `var(--*)` names.
- **`--editor-font` scoped to the editor only:** the epic names it *editor* font; the app
  chrome remains JetBrains Mono per the design system's one-face rule.
- **CM6 `dark` flag via memoized extension swap, not a Compartment:** `@uiw/react-codemirror`
  reconfigures when the `extensions` prop identity changes; memoizing on `theme` confines
  that to real theme switches and module-level base extensions keep their state fields.
- **No settings write-back here:** this slice is read/apply only; mutation UI is #29.

## Validation Criteria

- [x] `pnpm build` passes (tsc + vite)
- [x] `pnpm lint` passes (`pnpm check` — lint + format — also passes)
- [ ] With `settings.json` `"theme": "light"`, the whole app (chrome + editor) renders the
      light palette on boot _(GUI smoke test — not possible from the headless runner)_
- [ ] With `"editorFont": "Menlo"` (or any installed family), only the editor's font
      changes _(same)_
- [ ] Default boot (no settings file) is pixel-identical to before this change
      _(same; by construction: dark tokens and the `--editor-font` default are unchanged
      until settings load, and `settings.json` defaults to `dark`/JetBrains Mono)_

## Open Questions

None (issue body unavailable; deviations, if any, to be reconciled at ship-note time).
