# Plan: Factory token & font foundation

> Status: **approved**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #56

## Goal

Rewrite Orbit-111's design-token layer and typography to the **Factory** system, and add the
Geist / Geist Mono fonts. This is the foundation every other Factory slice builds on: because
all 18 components and the CM6 editor consume tokens through the Tailwind `@theme` utilities and
the shadcn semantic layer, changing token *values* here re-skins the entire app in one slice
while keeping token *names* stable so nothing downstream breaks.

## Context

- **Current state:** Tailwind v4 + shadcn. Raw Orbit tokens live in `src/styles/tokens/*.css`
  (`--bg`, `--surface`, `--surface-2`, `--border`, `--border-active`, `--text`, `--text-dim`,
  `--text-faint`, `--fab-accent`). `src/styles/index.css` maps them onto a shadcn semantic layer
  (`--background`, `--primary`, …) and then into Tailwind utilities via two `@theme` blocks.
  Typography is single-face self-hosted **JetBrains Mono** (`--font-sans` == `--font-mono`).
  Dark is the default palette; `:root[data-theme="light"]` overrides it (applied by
  `useApplyTheme`).
- **Trigger:** Adopt the Factory design system (`new-system-design-files-to-use/DESIGN.md` +
  `design-tokens.json` + `css-variables.css`).
- **Decisions (from planning):**
  1. Keep **both** dark and light themes. Dark = Factory-pure (obsidian canvas). Light = a
     Factory-derived mirror (bone/chalk light surfaces, same contrast ordering).
  2. Adopt **Geist** (body/headings) + **Geist Mono** (labels/eyebrows) as two distinct faces.
- **Constraint — keep token NAMES stable:** downstream components use utilities like `bg-bg`,
  `bg-surface`, `text-text`, `text-text-dim`, `border-border-active`, `font-mono`,
  `tracking-caps`. Do **not** rename these Tailwind utility mappings; only change the underlying
  values and ADD new ones (Factory accents, Geist font var, larger heading sizes). This keeps
  this slice's blast radius to token values + shared primitives.
- Read `.agents/ubiquitous-language.md` before editing (domain-glossary rule). `--fab-accent`,
  `--editor-font`, `ChatMessage.role`, the accent-discipline note, and `Button`/`Badge` are
  glossary-tracked; update the glossary if you change token semantics.
- This is Wave 1 of epic #55 ("adopt Factory design system") — see
  `.agents/plans/2026-07-10-epic-factory-design-system.md`. Waves 2 (#57-#60) all depend on
  this issue and are blocked until it merges to `main`.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/styles/tokens/colors.css` | Rewrite dark + light palettes to Factory colors; add signal-orange / metric-green accents |
| MODIFY | `src/styles/tokens/typography.css` | Add `--font-geist` + `--font-geist-mono`; split `--font-sans` (Geist) from `--font-mono` (Geist Mono); rescale sizes; add heading/display sizes + tracking |
| MODIFY | `src/styles/tokens/spacing.css` | Add Factory radii (3 / 10 / 20px) and keep the 4px grid; align `--radius-*` |
| MODIFY | `src/styles/tokens/motion.css` | Align easing/duration to Factory (`cubic-bezier(0.4,0,0.2,1)`, 0.15–0.2s) |
| MODIFY | `src/styles/index.css` | Swap font `@import`s to Geist; re-map shadcn semantic layer + `@theme` blocks onto new tokens; expose accent + Geist utilities |
| MODIFY | `package.json` | Add `@fontsource-variable/geist` + `@fontsource-variable/geist-mono` (or non-variable equivalents); remove JetBrains Mono if fully unused |
| MODIFY | `src/components/ui/button.tsx` | Re-express variants in Factory: dark-fill (`--color-carbon-lift`), ghost (hairline `--color-ash-stroke`), light-fill (chalk) |
| MODIFY | `src/components/ui/badge.tsx` | Factory mono-uppercase label chip, hairline border, `--tracking-caps` |
| MODIFY | `.agents/ubiquitous-language.md` | Record token/accent/font changes; bump "Last updated" + changelog |

## Step-by-Step Implementation

1. **Add the fonts.** In `package.json` dependencies add `@fontsource-variable/geist` and
   `@fontsource-variable/geist-mono` (pin to the latest 5.x). Run `pnpm install`. In
   `src/styles/index.css`, replace the five `@fontsource/jetbrains-mono/*.css` imports with the
   Geist + Geist Mono imports (variable font CSS entry points). Keep the
   `@import "tailwindcss";` line first. If nothing else references JetBrains Mono, drop
   `@fontsource/jetbrains-mono` from `package.json`.
   - **Why:** establishes the two-face type system (Geist sans + Geist Mono) the rest of the
     epic depends on.

2. **Rewrite `colors.css` — dark palette.** Map Factory colors onto the existing token names so
   downstream utilities keep working:
   - `--bg: #101010` (obsidian canvas) · `--surface: #1d1a18` (carbon lift) ·
     `--surface-2: #252220` (a hair above carbon for the raised step — pick a value between
     carbon-lift and ash-stroke).
   - `--border: #3d3a39` (ash stroke) · `--border-active: #4d4947` (graphite mid).
   - `--text: #eeeeee` (bone) · `--text-dim: #8a8380` (warm granite) · `--text-faint: #4d4947`.
   - Add the raw Factory names as first-class tokens too, for direct use:
     `--color-obsidian-canvas`, `--color-carbon-lift`, `--color-ash-stroke`,
     `--color-graphite-mid`, `--color-warm-granite`, `--color-pale-stone`, `--color-bone`,
     `--color-chalk`, `--color-signal-orange: #ee6018`, `--color-metric-green: #a0ca92`.
   - **Accent discipline:** repurpose the reserved-accent slot. Replace
     `--fab-accent`/`--fab-accent-dim` (lime) with `--accent-signal: #ee6018` and
     `--accent-metric: #a0ca92` (keep `--fab-accent` as an alias to `--accent-signal` for one
     release so the AiFab in child #58 compiles before it is restyled — note this in the
     glossary).
   - **Why:** the values-only edit re-skins the whole app in one slice while keeping every
     downstream utility name intact.

3. **Rewrite `colors.css` — light palette** under `:root[data-theme="light"]`: a
   Factory-derived mirror. Bone/chalk become surfaces (`--bg: #fafafa`, `--surface: #eeeeee`,
   `--surface-2: #e4e2df`), obsidian becomes text (`--text: #101010`, `--text-dim: #4d4947`,
   `--text-faint: #8a8380`), borders from the warm-gray ramp. Keep the accents
   (`#ee6018`/`#a0ca92`) but darken signal-orange slightly if contrast on the light `--bg` fails
   WCAG for small text (it is a data-voice color, rarely used for text).

4. **Rewrite `typography.css`.** Add `--font-geist` and `--font-geist-mono` (the exact stacks
   from `DESIGN.md` Quick Start). Set `--font-sans: var(--font-geist)` and
   `--font-mono: var(--font-geist-mono)` — this is the key two-face split; keep
   `--editor-font: var(--font-mono)` (child #59 owns the editor face). Re-scale to Factory:
   caption 12 / body-sm 14 / body 16, heading 36 / heading-lg 44 / display 72 (add
   `--font-size-heading`, `--font-size-heading-lg`, `--font-size-display` + their line-heights).
   Add tracking tokens: `--tracking-display: -0.04em`, `--tracking-caps: -0.02em` (Factory mono
   labels use tight tracking, not the wide `0.18em` of the old system — verify against
   `DESIGN.md` §Typography and adjust any component relying on wide caps in a later slice). Keep
   the 300–700 weight vars but note Factory uses 400 almost everywhere, 500 for emphasis.

5. **Update `spacing.css`.** Keep the 4px grid vars. Set `--radius-sm: 3px` (buttons/nav),
   `--radius-md: 10px` (cards), and add `--radius-lg: 20px` (large panels) per Factory. Leave
   `--radius-full` for pills.

6. **Update `motion.css`.** Set `--ease: cubic-bezier(0.4, 0, 0.2, 1)` and `--dur: 180ms`
   (Factory's 0.15–0.2s mechanical feel).

7. **Rewire `index.css`.** In the shadcn `:root` semantic block and the two `@theme` blocks:
   keep every existing mapping name, but (a) add `--color-signal` / `--color-metric` utilities
   pointing at the accent tokens, (b) add `--font-geist` / `--font-geist-mono` to the `@theme`
   sans/mono slots, (c) add the new heading/display `--text-*` utilities. Do not delete existing
   utility names.

8. **Restyle `ui/button.tsx`.** Rework `buttonVariants` (cva) to Factory: `primary` → dark fill
   `bg-[var(--color-carbon-lift)] text-text border-transparent hover:bg-[var(--color-graphite-mid)]`;
   `ghost` → `border-[var(--color-ash-stroke)] bg-transparent text-text
   hover:border-[var(--color-chalk)] hover:text-[var(--color-chalk)]` (border/text shift only,
   never a fill — see `DESIGN.md` Ghost Text Link); add a `light` variant → chalk fill, obsidian
   text (the nav "Log In" treatment). Keep `rounded-sm` (now 3px), `font-mono` for label voice,
   and the existing size/kbd variants.

9. **Restyle `ui/badge.tsx`** to the Factory mono label chip: Geist Mono 12px uppercase,
   `tracking-[var(--tracking-caps)]`, hairline `border-[var(--color-ash-stroke)]`, no fill. Keep
   existing variant API.

10. **Update the glossary.** In `.agents/ubiquitous-language.md`, record: fonts JetBrains Mono →
    Geist + Geist Mono (two-face), the palette swap, `--fab-accent` (lime) →
    `--accent-signal`/`--accent-metric` (orange/green data-voice), and the accent-discipline
    change. Bump "Last updated" and add a Changelog row.

## Architecture Decisions

- **Token names stay; values change.** The whole point of the layered token system is that a
  re-skin is a values-only edit. Renaming utilities would force edits into every component and
  defeat the parallel decomposition.
- **Two-face split at the token layer.** Sans/mono divergence is expressed once
  (`--font-sans` = Geist, `--font-mono` = Geist Mono); components already use `font-mono` vs
  default, so the "instrument vs page" voice largely falls out for free — later slices only fix
  the handful of body-text spots currently using `font-mono`.
- **`--fab-accent` alias kept for one slice** so child #58 (chat) still compiles before it swaps
  the lime FAB accent to signal-orange. This avoids a hard cross-slice ordering constraint.
- **Both themes retained** per the product decision; the light palette is a Factory-derived
  mirror, not the old zinc ramp.

## Validation Criteria

- [ ] `pnpm check && pnpm build` pass (Biome + `tsc` + Vite).
- [ ] `pnpm dev` renders the app in Factory dark colors with Geist type; the
      `data-theme="light"` toggle shows the Factory light mirror.
- [ ] No component references a now-deleted token/utility name (grep for `fab-accent-dim`,
      JetBrains Mono).
- [ ] `.agents/ubiquitous-language.md` updated with the token/font/accent changes + "Last
      updated" bump.

## Open Questions

- Variable vs static Geist packages — default to `@fontsource-variable/*`; fall back to static
  weights (400/500) if the variable axis bloats the bundle.
- Exact `--surface-2` dark value between carbon-lift and ash-stroke is an eyeball call; pick for
  a visible-but-subtle raised step.
