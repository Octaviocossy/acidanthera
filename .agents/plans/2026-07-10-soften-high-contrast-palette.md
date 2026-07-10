# Plan: Soften the Factory high-contrast palette

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none_

## Goal

Reduce the stark "high-contrast" feel of the UI — near-pure-black canvas (`#101010`)
under near-pure-white text (`#eeeeee`), ~16:1 — to a smoother, calmer look (~13:1) by
softening the two contrast extremes at the **design-token layer**, so every surface
(editor, sidebar, chat, dialogs, status bar) softens at once without per-component edits.

## Context

- **Current state.** The app runs the Factory design system. Its signature is deliberate,
  stark figure/ground contrast: obsidian canvas `#101010` with bone text/cards `#eeeeee`
  (`new-system-design-files-to-use/DESIGN.md` — "Build depth through #eeeeee-on-#101010
  contrast"). The user finds this too harsh and wants it smoother.
- **How the palette is wired** (verified by inspection):
  - `src/styles/tokens/colors.css` defines a raw Factory ramp (`--color-obsidian-canvas`,
    `--color-bone`, …) and maps **semantic tokens** onto it: `--bg`, `--surface`,
    `--surface-2`, `--border`, `--border-active`, `--text`, `--text-dim`, `--text-faint`,
    plus the two accents. A `:root[data-theme="light"]` block mirrors the same roles.
  - Every component and the CM6 editor theme (`src/lib/editor/theme.ts`) consume the
    **semantic** tokens (`var(--bg)`, `text-text`, `bg-surface`, `border-border-hairline`,
    …). There are **no hardcoded hex colors** anywhere in `src/` outside the token files,
    and **no CM6 syntax-highlight style** with its own colors (markdown highlighting
    inherits `--text`).
  - **One exception:** `src/components/ui/button.tsx` reaches past the semantic layer into
    the raw ramp for three variants — `primary`, `ghost`, `light`. Of these, **only
    `ghost` is used** in the app (StatusBar, Sidebar, SettingsDialog). Its hover jumps
    text/border to `--color-chalk` (`#fafafa`, the brightest value) — and in the light
    theme that hover is actually near-invisible (bright-on-bright). `primary` and `light`
    are defined but unused; the used `quiet` variant already uses semantic tokens.
- **Why this is low-risk.** Because the semantic layer is the single choke point, changing
  ~8 values in one file cascades to the entire UI. Token **names** stay identical, so this
  is a values-only re-skin (the same technique used by the Factory foundation slice #56).
- **Constraint / trade-off to acknowledge.** This intentionally deviates from Factory's
  stated philosophy ("keep the canvas `#101010` on every section"). That is accepted per
  the explicit user request. The raw Factory ramp tokens stay at their true documented
  values (they remain an honest record of the source system); only the semantic mapping
  and the one component that bypassed it are softened.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/styles/tokens/colors.css` | Soften the semantic token values (both dark `:root` and `:root[data-theme="light"]`); update the header comment. **Core change.** |
| MODIFY | `src/components/ui/button.tsx` | Repoint the `ghost` variant (and optionally the unused `primary`) off the raw ramp onto semantic tokens so it softens with everything else and its light-theme hover reads correctly. |
| MODIFY | `src/styles/index.css` | **Post-review fix (not in original plan).** Remove a self-referencing `--border: var(--border);` line in the shadcn semantic-layer `:root` block — see Step 6. |
| MODIFY | `.agents/ubiquitous-language.md` | Note the softened-contrast pass: `--bg`/`--text` (and siblings) no longer alias the pure Factory anchors; bump "Last updated" + add a Changelog row. |

_No other files change: the editor theme, badges, toasts, sidebar, chat, and dialogs all
consume the semantic tokens and inherit the softening automatically._

## Step-by-Step Implementation

> **Recommended intensity (baked into the steps below):** canvas lifted `#101010 → #1a1917`,
> primary text softened `#eeeeee → #e2dfdb`. This lowers dark-theme body contrast from
> ~16.4:1 to ~13.2:1 — still well above WCAG AAA (7:1), just visibly calmer. A **softer**
> alternative is given in Open Questions if the user wants to go further.

### Step 1 — Soften the dark (default) semantic tokens

- **File:** `src/styles/tokens/colors.css`
- **Action:** MODIFY — the `:root { … }` block (lines ~7–43).
- **Details:** Keep the raw `--color-*` Factory ramp (lines ~10–20) **unchanged**. Change
  only the **Surfaces / Borders / Text** mappings so the two extremes move toward the
  middle and the elevation steps stay legible on the lifted canvas. Replace:

  ```css
    /* Surfaces */
    --bg: var(--color-obsidian-canvas);
    --surface: var(--color-carbon-lift);
    --surface-2: #252220;

    /* Borders */
    --border: var(--color-ash-stroke);
    --border-active: var(--color-graphite-mid);

    /* Text */
    --text: var(--color-bone);
    --text-dim: var(--color-warm-granite);
    --text-faint: var(--color-graphite-mid);
  ```

  with:

  ```css
    /* Surfaces — lifted off pure obsidian for a softer canvas (was #101010 / carbon / #252220). */
    --bg: #1a1917;
    --surface: #232120;
    --surface-2: #2c2a27;

    /* Borders — unchanged (borders aren't the contrast complaint); kept on the Factory ramp. */
    --border: var(--color-ash-stroke);
    --border-active: var(--color-graphite-mid);

    /* Text — softened off pure bone; dim/faint lifted a touch for the lifted canvas. */
    --text: #e2dfdb;
    --text-dim: #97908b;
    --text-faint: #565250;
  ```

  Leave the Accent block (`--accent-signal`, `--accent-metric`, `--fab-accent*`) exactly
  as-is — functional accents are intentionally unchanged.
- **Why:** `--bg` and `--text` are the two tokens that produce the harsh look; every
  component reads them, so this single edit is 90% of the deliverable.

### Step 2 — Soften the light-theme semantic tokens (mirror)

- **File:** `src/styles/tokens/colors.css`
- **Action:** MODIFY — the `:root[data-theme="light"] { … }` block (lines ~47–66).
- **Details:** Apply the same "pull the extremes toward the middle" treatment so a
  light-theme user gets a matching, non-glaring result. Replace:

  ```css
    --bg: #fafafa;
    --surface: #eeeeee;
    --surface-2: #e4e2df;

    --border: #d6d3d0;
    --border-active: var(--color-warm-granite);

    --text: var(--color-obsidian-canvas);
    --text-dim: #4d4947;
    --text-faint: var(--color-warm-granite);
  ```

  with:

  ```css
    --bg: #f4f2ef;
    --surface: #ebe8e4;
    --surface-2: #e2deda;

    --border: #dcd8d4;
    --border-active: var(--color-warm-granite);

    /* Softened off pure obsidian text for a calmer light surface. */
    --text: #26231f;
    --text-dim: #5c5652;
    --text-faint: #837c77;
  ```

  Leave the light Accent block unchanged (`--accent-signal: #c24d10` stays — still passes
  contrast on the slightly-dimmer `--bg`).
- **Why:** Keeps the two themes consistent; the light theme has the same pure-white-vs-
  pure-black harshness (`#101010` on `#fafafa`, ~18:1) and should soften in step.

### Step 3 — Update the `colors.css` header comment

- **File:** `src/styles/tokens/colors.css`
- **Action:** MODIFY — the top comment (lines ~1–6) and the inline "Surfaces" note.
- **Details:** The current header says dark is "Factory-pure (obsidian canvas)". Adjust to
  state that the semantic layer intentionally runs a **softened** variant of Factory —
  the raw `--color-*` ramp still records the true Factory anchors, but `--bg`/`--text`
  are lifted/dimmed off them to reduce contrast per user preference. One or two sentences;
  no behavior change.
- **Why:** Prevents a future reader from "fixing" the mapping back to the pure anchors.

### Step 4 — Repoint the `ghost` button variant onto semantic tokens

- **File:** `src/components/ui/button.tsx`
- **Action:** MODIFY — the `ghost` variant string (and, optionally, `primary`).
- **Details:** `ghost` currently hardcodes raw-ramp refs, so it would **not** soften with
  Steps 1–2 and its hover would snap to pure chalk `#fafafa`. Replace:

  ```ts
  ghost: 'border-[var(--color-ash-stroke)] bg-transparent text-text hover:border-[var(--color-chalk)] hover:text-[var(--color-chalk)]',
  ```

  with:

  ```ts
  ghost: 'border-border-hairline bg-transparent text-text hover:border-text hover:text-text',
  ```

  (`border-border-hairline` = `--border`; hovering to `--text` softens the hover **and**
  fixes it in light theme, where `--color-chalk` was bright-on-bright.)

  **Optional coherence polish (unused variant — do only if touching the file anyway):**
  repoint `primary` from the raw ramp to semantics:

  ```ts
  primary: 'border-transparent bg-surface text-text hover:bg-surface-2',
  ```

  Leave the `light` variant as-is — it is the intentional always-inverted "Log In"
  control and is currently unused; softening it is out of scope.
- **Why:** `ghost` is the only *used* variant bypassing the semantic layer; repointing it
  keeps the softening global and corrects a pre-existing light-theme hover bug.

### Step 5 — Update the domain glossary

- **File:** `.agents/ubiquitous-language.md`
- **Action:** MODIFY — required by `.agents/rules/domain-glossary.md` after touching
  canonical domain code (`src/`) that changes a documented mapping.
- **Details:**
  - Bump the top "**Last updated**" line to `2026-07-10` with a one-line summary
    ("Softened Factory contrast — `--bg`/`--text` (+ surfaces, dim/faint) lifted/dimmed
    off the pure Factory anchors in both themes; `Button` `ghost` repointed to semantic
    tokens").
  - In the "Factory raw palette tokens" note, add a sentence that the semantic tokens
    (`--bg`, `--text`, …) now intentionally sit a step in from the raw anchors rather than
    aliasing them 1:1.
  - Add a Changelog row (Date `2026-07-10`, this change, reason "user preference: reduce
    high-contrast starkness").
- **Why:** The glossary is the single source of truth for the token system; leaving it
  claiming `--bg` == obsidian would mislead the next agent.

### Step 6 — Fix a pre-existing `--border` self-reference bug (found during manual smoke test)

- **File:** `src/styles/index.css`
- **Action:** MODIFY — not in the original plan; added after the user reported dark-theme
  borders rendering "full white."
- **Root cause:** The shadcn semantic-layer mapping block (`:root { --background: var(--bg); …
  --border: var(--border); --input: var(--border); --ring: var(--border-active); }`) declared
  `--border: var(--border);` — a **self-reference**. Orbit's own hairline-border token is
  already named `--border` (`tokens/colors.css`), so this second declaration doesn't alias it,
  it *shadows* it with a value that points to itself. Per the CSS custom-property spec, a
  cyclic reference resolves to the property's guaranteed-invalid value, so `--border` — and
  everything derived from it (`--input`, `--color-border` inlined uses, `--color-border-hairline`)
  — computed to nothing. Every `border-color` built on those (`border-border`,
  `border-border-hairline` — `Button` ghost, `Badge` muted/plain, `StatusBar`, `Sidebar`,
  `ChatPanel`, `AiFab`, `ChatInput`, `SettingsDialog`, `ToastHost`, `CommandBar`, …) then fell
  back to the CSS initial fallback for an invalid custom property used with no `var()` fallback,
  which browsers resolve as `currentColor` — i.e. whatever text color was ambient at that
  element. Since `--text` sits near-white in dark mode (`#eeeeee` before this plan, `#e2dfdb`
  after), nearly every hairline border in the app rendered bright/white instead of the intended
  dark hairline gray (`#3d3a39`) — **this bug pre-dates this plan** (introduced whenever the
  shadcn mapping block was written) but was only reported once the softened palette made the
  team look closely at border color.
- **Fix:** Delete the `--border: var(--border);` line. `--input: var(--border);` and the
  `@theme inline` block's `--color-border: var(--border);` already correctly reference
  `tokens/colors.css`'s real `--border` once the shadowing declaration is gone — no other
  change needed.
- **Verification:** Reloaded the app in Chrome (`pnpm dev`, browser-driven since the packaged
  Tauri app wasn't available in this environment) and confirmed via `getComputedStyle`:
  `--border` now resolves to `#3d3a39` (dark) / `#dcd8d4` (light) instead of `""` (invalid);
  the `AiFab` and `Button` ghost borders now render the intended dark hairline instead of
  near-white. `pnpm build`/`lint`/`format` re-run clean after the fix.
- **Why:** This directly caused the "full white borders" the user flagged; fixing the token
  values in Steps 1–2 without this fix would have left every hairline border ignoring the new
  palette entirely (they were never reading `--border` at all).

## Architecture Decisions

- **Soften at the semantic layer, not the raw ramp.** The raw `--color-*` tokens document
  the true Factory source palette (and are cited verbatim in `DESIGN.md` and the glossary);
  revaluing `--color-obsidian-canvas` to a non-obsidian value would make the name lie. The
  semantic tokens are, by design, the theming layer that already flips per theme — the
  correct and truthful place to tune contrast.
- **Change values, keep names.** Because names are stable, no component (editor, sidebar,
  chat, dialogs, toasts, badges) needs editing; this mirrors the values-only re-skin
  pattern established by the Factory foundation slice (#56).
- **Repoint `ghost` rather than revalue chalk.** The one component bypassing semantics is
  fixed at the component, not by dimming the shared `--color-chalk` anchor (which is a
  documented Factory value). This also fixes a latent light-theme hover bug for free.
- **Accents untouched.** Signal-orange / metric-green are functional data-voice colors, not
  part of the contrast complaint; leaving them keeps the status/live semantics intact.
- **Deliberate deviation from Factory.** DESIGN.md prescribes the stark `#101010`/`#eeeeee`
  contrast; we knowingly depart from it on explicit user preference and record that in the
  code comment (Step 3) and glossary (Step 5).

## Validation Criteria

- [x] `pnpm build` passes (runs `tsc` — the className change type-checks; CSS is not typed).
- [x] `pnpm lint` (Biome) passes.
- [x] `pnpm format` leaves the files clean (or is run to format them).
- [x] `grep -rniE '#[0-9a-f]{3,6}' src --include='*.tsx' --include='*.ts'` still returns
      nothing outside `src/styles/` — no hex leaked into components.
- [x] Manual smoke test (`pnpm dev`, driven via Chrome since the vite dev server serves the
      frontend standalone — Tauri-backed features like chat/vault-open were not exercisable
      outside the packaged app, see note):
  - [x] Dark theme: canvas is a soft charcoal (`#1a1917`, not pure black), body text is a warm
        off-white (`#e2dfdb`, not glaring), editor / sidebar / status bar all look consistent.
        (Chat panel not opened — requires a live vault + agent backend, unavailable outside
        the Tauri runtime.)
  - [x] Ghost buttons (Sidebar "Open vault…") hover to the softened `--text` color in both
        themes, confirmed via computed style (`border-color`/`color` on `:hover` matches
        `--text`, not `--color-chalk`). StatusBar/SettingsDialog ghost buttons share the same
        variant so inherit the fix; SettingsDialog's own content didn't render (Tauri
        `read_settings` unavailable outside the packaged app) so its vault-row hover wasn't
        pixel-checked directly.
  - [x] Toggled `data-theme="light"` directly (Settings UI needs Tauri): text renders soft
        charcoal (`#26231f`) on soft off-white (`#f4f2ef`), and ghost-button hover resolves to
        `--text` (`#26231f`) — visible, not bright-on-bright as before.
  - [x] `--accent-signal` (`#ee6018`) / `--accent-metric` (`#a0ca92`) confirmed unchanged via
        computed style in both themes. AiFab pulse / ThinkingIndicator / ToolChip not visually
        exercised (require an active chat session, unavailable outside the Tauri runtime) —
        low risk since the Accent block in `colors.css` was untouched by this change.

## Open Questions

- **Softening intensity.** The steps use a *moderate* setting (dark body ~13.2:1). If the
  user wants it **softer still**, use these instead in Step 1 (dark) — roughly ~10.5:1:
  `--bg: #1e1c1a; --surface: #272522; --surface-2: #302d2a; --text: #d8d5d0;
  --text-dim: #9c948f; --text-faint: #5c5754;` and correspondingly lift the light `--bg`
  to `#f1efec` / lower light `--text` to `#2c2925`. Not a blocker — the recommended values
  are executable as-is; this is a dial the user can turn after seeing it live.
