# Plan: Widen Sidebar & Minimalist Scrollbars

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none_

## Goal

Two small visual refinements to the app shell: (1) give the vault sidebar more
horizontal room so longer note/folder names fit, and (2) replace the browser-default
scrollbars with thin, trackless, theme-aware scrollbars so every scroll region reads as
minimalist Factory chrome instead of a chunky OS bar.

## Context

- **What exists today:**
  - The sidebar width is a single design token: `--rail-sidebar: 240px`
    (`src/styles/tokens/rails.css:6`), consumed in exactly one place —
    `Sidebar.tsx:96` via `w-[var(--rail-sidebar)]`. No other consumer.
  - There is **no custom scrollbar styling anywhere** in the codebase. A repo-wide grep
    for `scrollbar` / `::-webkit` returns nothing, so all three scroll regions render the
    platform-default WKWebView scrollbar.
  - Three scroll regions exist, all vertical-only:
    1. Sidebar tree — `Sidebar.tsx:119` (`overflow-y-auto`)
    2. Chat transcript — `ChatPanel.tsx:58` (`overflow-y-auto`)
    3. CodeMirror editor — `.cm-scroller` inside `Viewer.tsx` (CM6 owns the element;
       `EditorView.lineWrapping` means it never scrolls horizontally, #37).
  - Global element/pseudo styles already live in `src/styles/index.css` (the `html, body`
    and `#root` blocks at the bottom). The `tokens/*.css` files are strictly CSS variables.

- **What prompted this work:** direct user request for visual changes — a wider sidebar
  and smaller/more minimalist scrollbars.

- **Constraints the implementer must know:**
  - **Target runtime is Tauri**, so the webview is always WebKit-family: WKWebView on
    macOS, WebKitGTK on Linux, Chromium/WebView2 on Windows. **All three support the
    `::-webkit-scrollbar` pseudo-elements; none is Firefox/Gecko.** This is why the plan
    styles scrollbars purely via `::-webkit-scrollbar` and deliberately **omits** the
    standard `scrollbar-width` / `scrollbar-color` properties — see Architecture Decisions
    for the precedence gotcha that makes mixing them harmful on WebKit.
  - Scrollbar colors must use existing semantic tokens (`--border`, `--border-active`) so
    they flip automatically with the light/dark theme (`data-theme`, #28) and add **no new
    domain surface** to `.agents/ubiquitous-language.md`.
  - Changing `--rail-sidebar`'s *value* (not its name) requires no glossary update — token
    names stay stable, matching the Factory-foundation convention (#56).

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/styles/tokens/rails.css` | Widen `--rail-sidebar` 240px → 280px |
| MODIFY | `src/styles/index.css` | Add the global minimalist `::-webkit-scrollbar` block |

No component `.tsx` files change: the sidebar reads the token, and the scrollbar rules are
global pseudo-elements that reach all three scroll regions (including CM6's `.cm-scroller`,
which is light DOM) without touching component markup.

## Step-by-Step Implementation

> **Step 1 — Widen the sidebar rail token**
>
> - **File:** `src/styles/tokens/rails.css`
> - **Action:** MODIFY
> - **Details:**
>   - Change line 6 from:
>     ```css
>       --rail-sidebar: 240px;
>     ```
>     to:
>     ```css
>       --rail-sidebar: 280px;
>     ```
>   - Do **not** change `--rail-chat` (360px) or any other rail — only the sidebar.
>   - 280px is the recommended value (~17% wider, comfortable for nested folder + note
>     names at the current `--font-size-xs` tree rows without crowding the editor). It is
>     trivially tunable; 300px is also reasonable if the user wants more. Leave the trailing
>     comment/structure of the file untouched.
> - **Why:** The width is fully token-driven and single-sourced, so one value edit widens
>   the sidebar everywhere it is used with zero component changes.

> **Step 2 — Add the global minimalist scrollbar rules**
>
> - **File:** `src/styles/index.css`
> - **Action:** MODIFY
> - **Details:**
>   - Append the following block to the **end** of the file, after the existing `#root { … }`
>     rule (this file is where global element/pseudo styles already live, keeping the token
>     files variable-only):
>     ```css
>
>     /* Minimalist scrollbars — thin, trackless, theme-aware.
>        Tauri's webview is always WebKit-family (WKWebView / WebKitGTK / Chromium), so
>        `::-webkit-scrollbar` is universally supported. We intentionally do NOT set the
>        standard `scrollbar-width` / `scrollbar-color`: on Safari 18.2+ / modern WebKit,
>        setting either one DISABLES the `::-webkit-scrollbar` pseudo-elements, which would
>        drop this fine-grained styling. Colors use the semantic border tokens so they flip
>        with `data-theme` (#28). This one global rule also covers CM6's `.cm-scroller`
>        (light DOM) — the editor, sidebar tree, and chat transcript all inherit it. */
>     ::-webkit-scrollbar {
>       width: 8px;
>       height: 8px;
>     }
>
>     ::-webkit-scrollbar-track {
>       background: transparent;
>     }
>
>     ::-webkit-scrollbar-thumb {
>       background-color: var(--border);
>       border-radius: var(--radius-full);
>       /* Transparent border + padding-box clip insets the thumb to ~4px visible width,
>          so it reads as a hairline sliver rather than a solid 8px bar. */
>       border: 2px solid transparent;
>       background-clip: padding-box;
>     }
>
>     ::-webkit-scrollbar-thumb:hover {
>       background-color: var(--border-active);
>     }
>
>     ::-webkit-scrollbar-corner {
>       background: transparent;
>     }
>     ```
>   - `var(--border)`, `var(--border-active)`, and `var(--radius-full)` are all already
>     defined (`tokens/colors.css` lines 32–33 / 58–59, `tokens/spacing.css:25`) and flip
>     per theme — do not introduce new `--scrollbar-*` tokens.
> - **Why:** A single global pseudo-element block gives every scroll region the same thin,
>   trackless, theme-aware scrollbar with no per-component edits, and reusing the border
>   tokens keeps it automatically correct in both light and dark themes.

## Architecture Decisions

- **`::-webkit-scrollbar` only — no `scrollbar-width`/`scrollbar-color`.** Every Tauri
  webview is WebKit-family and supports the WebKit pseudo-elements, so we get full control
  (thin width, transparent track, inset rounded thumb, hover state) that the standard
  two-value `scrollbar-color` model cannot express. Critically, on modern WebKit (Safari
  18.2+, current WebKitGTK) the presence of `scrollbar-width` or `scrollbar-color` *opts
  the element into the standard model and disables `::-webkit-scrollbar`*. Setting both
  "for coverage" would therefore silently break the styling on the exact platform we ship.
  Since no Tauri webview is Gecko, the Firefox-only standard properties buy us nothing, so
  we omit them.

- **Global rule instead of per-region classes.** The three scroll regions want identical
  minimalist scrollbars, and CM6's `.cm-scroller` is light DOM reachable by global CSS, so
  a single global block is simpler and guarantees consistency. If a region ever needs a
  different scrollbar, it can override with a scoped `.selector::-webkit-scrollbar` later.

- **Reuse `--border` / `--border-active`, add no tokens.** These already theme-flip and
  match the hairline visual language (the resting thumb is the same weight as a hairline
  divider; hover lifts to the active-border weight). Avoiding new tokens keeps the domain
  glossary unchanged — this stays a pure value/style change.

- **Token-value edit for the sidebar, not a component change.** Width is single-sourced in
  `--rail-sidebar`; editing the value is the lowest-surface change and keeps the token name
  (and thus the glossary and all consumers) stable.

## Validation Criteria

- [ ] Sidebar renders visibly wider (280px) — longer folder/note names that previously
      truncated or crowded now have more room; the editor/chat still fit.
- [ ] All three scroll regions (sidebar tree, chat transcript, CodeMirror editor) show a
      thin (~4px visible) rounded scrollbar with a transparent track, not the chunky OS bar.
- [ ] Scrollbar thumb brightens from `--border` to `--border-active` on hover.
- [ ] Scrollbar colors are correct in **both** light and dark themes (toggle via Settings)
      — visible against the surface, never invisible or high-contrast-jarring.
- [ ] `pnpm build` passes (the only `tsc` invocation).
- [ ] `pnpm lint` passes.
- [ ] Manual smoke test: `pnpm dev`, open a vault with enough notes to force the sidebar to
      scroll and a long note to force the editor to scroll; confirm both look minimalist and
      the editor still has no horizontal scrollbar (line wrapping, #37).

## Open Questions

None. (Recommended sidebar width is 280px and scrollbar thumb is ~4px visible; both are
single-value tweaks the user can nudge on review without structural change.)
