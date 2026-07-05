# Plan: Clean up `biome.json`

> Status: **completed**
> Created: 2026-07-05
> Updated: 2026-07-05
> Issue: — (none)

## Goal

Strip `biome.json` down to what this repo actually is — a **single-package Tauri 2 + React 19 +
Vite 7** app — by removing config copy-pasted from an unrelated Turborepo (phantom `apps/`,
`packages/`, Next.js, Drizzle, Playwright, NestJS, TanStack Router paths and rules), and fix the
one real path that is wrong (the Tauri build-output ignore).

## Context

- **Current state:** `biome.json` is 121 lines. It was clearly lifted from a larger monorepo. I
  verified every path it references against the filesystem — **all are phantom except
  `src-tauri/target`:**
  - MISSING: `apps/`, `apps/desktop`, `apps/api`, `packages/`, `drizzle`, `src/components/ui`,
    `.next`, `.turbo`, `.tmp-biome-md-repro`, `routeTree.gen.ts`, `next-env.d.ts`.
  - The actual source tree is only `src/App.tsx`, `src/main.tsx`, `src/App.css`,
    `src/vite-env.d.ts`, `src/assets/`.
- **Trigger:** User asked to "make a cleanup in `biome.json`."
- **Key correctness issues found (not just cosmetic):**
  1. **`performance.noImgElement: "error"`** is a **Next.js-specific** rule (pushes `next/image`
     over `<img>`). This Tauri/Vite app has no `next/image`; `src/App.tsx` uses three plain `<img>`
     tags. It only passes today because `overrides[0]` (`src/**`) turns the rule back **off** — a
     convoluted no-op. Remove the rule and the override.
  2. **Wrong Tauri ignore path:** the config ignores `apps/desktop/src-tauri/target`, but this
     repo's Rust build output is at **`src-tauri/target`** (exists, multi-GB). It is currently
     skipped only because `vcs.useIgnoreFile: true` honors `src-tauri/.gitignore` — not because of
     any glob here. If `useIgnoreFile` were ever disabled, Biome would scan `target/`. Replace the
     phantom glob with the real path.
  3. **All 3 `overrides` target non-existent files** → dead.
  4. **`javascript.parser.unsafeParameterDecoratorsEnabled: true`** is for decorator-heavy backends
     (NestJS/TypeORM). No decorators exist in this React frontend → dead.
  5. **`javascript.assist.enabled: true`** duplicates the top-level `assist.enabled: true` → redundant.
  6. **`suspicious.noUnknownAtRules: "off"`** exists for Tailwind/PostCSS at-rules. `src/App.css`
     is plain CSS (only standard `@media`) → the toggle is unnecessary (verified: recommended rule
     won't fire on standard at-rules).
- **Constraints / must-preserve:**
  - Biome version is **2.2.0** (matches `$schema` and installed `@biomejs/biome`). Do not change
    the schema URL.
  - The cleanup must be **behavior-preserving**: `pnpm biome check` currently reports
    *"Checked 15 files … No fixes applied"* (clean). It must still report the same after cleanup.
    Every removed glob is phantom (matches zero real files), so the checked-file set stays at 15.
  - **Do not reformat the codebase.** Keep `formatter.lineWidth: 180` and all `javascript.formatter`
    preferences as-is; changing them would rewrite `src/`. Formatting-preference changes are out of
    scope for a "cleanup" (see Open Questions).
  - **Keep** the intentional, valid preference toggles: `a11y.useSemanticElements: off`,
    `correctness.useExhaustiveDependencies: off` (React), `style.useSelfClosingElements: warn`,
    `suspicious.noConsole: warn`.
  - **Keep** `!.agents` and `!.claude` ignores — those dirs exist and hold governance/tooling files
    Biome should not touch.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `biome.json` | Remove phantom monorepo config + Next/NestJS rules; fix Tauri target ignore path |

> No other files change. `.vscode/settings.json` and `.vscode/extensions.json` already reference
> only `biomejs.biome` and standard file types — they are correct and left as-is.

## Step-by-Step Implementation

This is a single-file rewrite. Replace the entire contents of `biome.json` with the target below,
then verify. The intermediate steps document *why* each block is dropped so the diff is reviewable.

> **Step 1 — Remove the Next.js `noImgElement` rule and its dead override**
>
> - **File:** `biome.json`
> - **Action:** MODIFY
> - **Details:** Delete the `linter.rules.performance` block entirely (lines 32-34):
>   ```json
>   "performance": { "noImgElement": "error" },
>   ```
>   and delete `overrides[0]` (lines 90-99) whose only purpose was to turn that rule `off` for
>   `apps/desktop/**` + `src/**`.
> - **Why:** `noImgElement` is a Next.js rule; plain `<img>` is correct in a Tauri/Vite app, so the
>   rule + its counter-override cancel out to nothing.

> **Step 2 — Remove the two remaining phantom overrides**
>
> - **File:** `biome.json`
> - **Action:** MODIFY
> - **Details:** Delete `overrides[1]` (`apps/desktop/src/routeTree.gen.ts` → `noExplicitAny: off`)
>   and `overrides[2]` (`apps/api/src/modules/auth/**/*.ts` → `useImportType: off`). With all three
>   gone, remove the now-empty `"overrides": [...]` key entirely.
> - **Why:** Both target files/dirs that do not exist in this repo.

> **Step 3 — Slim `linter.rules` to the valid preference toggles**
>
> - **File:** `biome.json`
> - **Action:** MODIFY
> - **Details:** In `linter.rules`, keep `recommended`, `a11y.useSemanticElements: off`,
>   `correctness.useExhaustiveDependencies: off`, `style.useSelfClosingElements: warn`,
>   `suspicious.noConsole: { level: warn }`. Remove `suspicious.noUnknownAtRules: "off"` (no
>   Tailwind/unknown at-rules; `src/App.css` is plain CSS).
> - **Why:** `noUnknownAtRules: off` is an unnecessary suppression for this repo's plain CSS.

> **Step 4 — Simplify the `javascript` block to formatter-only**
>
> - **File:** `biome.json`
> - **Action:** MODIFY
> - **Details:** Delete `javascript.parser` (the `unsafeParameterDecoratorsEnabled` block) and
>   `javascript.assist` (redundant with top-level `assist`). Keep `javascript.formatter` verbatim.
> - **Why:** No decorators in this codebase; JS assist is already enabled globally.

> **Step 5 — Fix `files.includes`: drop phantoms, correct the Tauri target path**
>
> - **File:** `biome.json`
> - **Action:** MODIFY
> - **Details:** Replace the entire `files.includes` array with:
>   ```json
>   "includes": [
>     "**",
>     "!.agents",
>     "!.claude",
>     "!**/dist",
>     "!**/coverage",
>     "!src-tauri/target",
>     "!src-tauri/gen"
>   ]
>   ```
>   - Keep `**`, `!.agents`, `!.claude`, `!**/dist`, `!**/coverage`.
>   - Replace `!!/apps/desktop/src-tauri/target` → `!src-tauri/target` (the real Rust build dir).
>   - Add `!src-tauri/gen` so Biome ignores Tauri's generated schema JSON (currently checked but
>     regenerated by the Tauri CLI — ignoring avoids reformat churn).
>   - Drop all phantom globs: `!drizzle`, `!!/.tmp-biome-md-repro`, `!!/.turbo`, `!**/.next`,
>     `!**/out`, `!**/build`, `!**/test-results`, `!**/playwright-report`, `!!/apps/*/*`,
>     `!!/apps/desktop/src/routeTree.gen.ts`, `!!/packages/*/dist`, `!**/next-env.d.ts`,
>     `!src/components/ui`.
> - **Why:** Only `dist`, `coverage`, `src-tauri/target`, and `src-tauri/gen` are real build/gen
>   outputs here; everything else references a project layout that does not exist.

> **Step 6 — Apply the final config**
>
> - **File:** `biome.json`
> - **Action:** MODIFY
> - **Details:** The net result of Steps 1-5 is this complete file (write it verbatim):
>   ```json
>   {
>     "$schema": "https://biomejs.dev/schemas/2.2.0/schema.json",
>     "vcs": {
>       "enabled": true,
>       "clientKind": "git",
>       "useIgnoreFile": true
>     },
>     "assist": {
>       "enabled": true,
>       "actions": {
>         "source": {
>           "organizeImports": "on"
>         }
>       }
>     },
>     "formatter": {
>       "enabled": true,
>       "indentStyle": "space",
>       "indentWidth": 2,
>       "lineWidth": 180
>     },
>     "linter": {
>       "enabled": true,
>       "rules": {
>         "recommended": true,
>         "a11y": {
>           "useSemanticElements": "off"
>         },
>         "correctness": {
>           "useExhaustiveDependencies": "off"
>         },
>         "style": {
>           "useSelfClosingElements": "warn"
>         },
>         "suspicious": {
>           "noConsole": {
>             "level": "warn"
>           }
>         }
>       }
>     },
>     "javascript": {
>       "formatter": {
>         "quoteStyle": "single",
>         "jsxQuoteStyle": "double",
>         "trailingCommas": "es5",
>         "semicolons": "always"
>       }
>     },
>     "files": {
>       "ignoreUnknown": true,
>       "includes": [
>         "**",
>         "!.agents",
>         "!.claude",
>         "!**/dist",
>         "!**/coverage",
>         "!src-tauri/target",
>         "!src-tauri/gen"
>       ]
>     }
>   }
>   ```
> - **Why:** ~121 → ~55 lines, every remaining key maps to something real in this repo.

## Architecture Decisions

- **Behavior-preserving, not opinion-changing:** the cleanup removes *dead* config and one wrong
  path. It deliberately does **not** touch formatting width, quote/semicolon style, or the four
  intentional rule toggles — those are working preferences, and changing them would churn `src/`.
- **`noImgElement` fully removed rather than left `off` in an override:** the rule is not part of
  Biome's `recommended` set, so simply not mentioning it means it never runs — cleaner than an
  `error` base + `off` override that net to nothing.
- **`!src-tauri/gen` added (mild behavior change):** those JSON files are Tauri-generated and were
  being checked. Ignoring them prevents reformat churn when the Tauri CLI regenerates them. They
  are currently clean, so this does not hide any existing issue. Flagged in Open Questions in case
  you'd rather keep them formatted.
- **`useIgnoreFile` retained as the primary ignore mechanism:** `!src-tauri/target` is added as
  explicit, self-documenting insurance, but `.gitignore` remains the real guard.

## Validation Criteria

- [x] `biome.json` is valid JSON and validates against the 2.2.0 schema (no editor schema errors).
- [x] `pnpm biome check` still reports **"No fixes applied"** and a clean run.
- [x] File count checked is unchanged **or lower** (15, or 15 minus the `src-tauri/gen` schema
      files if Step 5's `!src-tauri/gen` is kept) — never higher (no phantom removal should pull in
      new files). Confirmed: 15 files, unchanged.
- [x] `pnpm lint` passes (`biome lint`).
- [x] `pnpm format --write` produces **no changes** to `src/**` (proves formatting behavior is
      unchanged). Confirmed: "Formatted 15 files... No fixes applied."
- [x] `grep -E 'apps|packages|drizzle|next|turbo|routeTree|components/ui|noImgElement|unsafeParameterDecorators' biome.json`
      returns nothing (all phantom config gone). Confirmed: no matches.
- [x] `src/App.tsx`'s `<img>` tags still lint clean (confirms `noImgElement` removal was safe).
      Confirmed via clean `pnpm lint` run.

**Note:** the final `files.includes` array was written on a single line rather than
multi-line as shown in Step 6's snippet — Biome's own formatter (with `lineWidth: 180`)
collapses short arrays like this one, and the plan requires the *behavior* (config content)
to match, not the literal on-disk line-wrapping. Verified via `pnpm biome check`, which only
passed once the array was collapsed.

## Open Questions

- **`src-tauri/gen` ignore:** OK to stop linting Tauri's generated schema JSON (recommended), or
  keep formatting them?
- **`lineWidth: 180`:** Left as-is to avoid reformatting. Want a separate follow-up to narrow it to
  a more conventional `100`/`120` (that *would* reformat `src/`), or keep 180?
- **`noConsole: warn`:** A Tauri app may legitimately log to console. Keep the warning, or drop it?
  (Left as-is for now.)
