# Plan: Keybindings Reference Doc

> Status: **completed**
> Created: 2026-07-09
> Updated: 2026-07-09

## Goal

Create a single, exhaustive, user-facing reference document — `doc/keybindings.md` — that lists every keyboard shortcut currently implemented in orbit-111, organized by scope, so a user (or a future contributor) can look up "what does this key do" without reading source code.

## Context

**Current state:** orbit-111 is a vim-first, keyboard-first app (`doc/v0-spec.md` §3.4, §5.5), but there is **no dedicated keybinding-reference doc anywhere in the repo**. `doc/v0-spec.md` documents the *design/architecture* of the keybinding system in prose (why there are two vim levels, the `Ctrl-w` exit-prefix rule, the CodeMirror coexistence rule) but contains no exhaustive key table. `.agents/ubiquitous-language.md` has precise one-line restatements of two chords (for entities `useGlobalKeymap` and `regionExit`) but is a glossary, not user docs. The README has no shortcuts section.

**Trigger:** user requested "a doc with the keybind[ings]."

**Full inventory of implemented keybindings** (gathered by reading every relevant source file — this is the exhaustive source of truth for Step 1 below):

1. **App-level global keymap** — `src/hooks/use-global-keymap.ts` (registered once in `App.tsx`), fires on `window` in the bubble phase:
   - `Ctrl-w` then `h` (within 1500ms) — anywhere not an editable target — `store.focusPrevious()` (cycles `activeRegion`: sidebar → viewer → chat, wrapping; chat only reachable if open)
   - `Ctrl-w` then `l` (within 1500ms) — same precondition — `store.focusNext()`
   - `Ctrl-w` then `c` (within 1500ms) — same precondition — `store.toggleChat()`
   - `Ctrl-w` alone — arms the chord for 1500ms; any other key or timeout disarms it silently
   - `:` — only when `mode === 'normal'` and target not editable — `store.setMode('command')`, opens the `CommandBar`
   - `Escape` — only when `mode === 'command'` — `store.setMode('normal')`, closes the command bar

2. **Sidebar keymap** — `src/hooks/use-sidebar-keymap.ts` (registered in `Sidebar.tsx`). All require `activeRegion === 'sidebar'`, `mode === 'normal'`, no modifier keys, non-editable target:
   - `j` — move cursor to next row (clamped)
   - `k` — move cursor to previous row (clamped)
   - `l` / `Enter` — on a directory: toggle expand; on a file: open it via `openVaultFile` and move focus to `viewer`
   - `h` — on an expanded directory: collapse it (no-op on files/collapsed dirs)

3. **Editor region-exit chord** (CM6 extension) — `src/lib/editor/region-exit.ts`, wired into `Viewer.tsx`'s extensions at `Prec.highest`. Mirrors item 1's `Ctrl-w h`/`Ctrl-w l`/`Ctrl-w c` exactly, but scoped to "editor has focus," and calls `stopPropagation()` so the window-level listener doesn't double-fire.

4. **Editor save binding** — `src/lib/editor/save.ts`, wired into `Viewer.tsx`:
   - `:w` (vim ex-command, registered via `Vim.defineEx('write', 'w', ...)`) — while in vim ex/command mode — bumps `saveIntent`, which `useSaveLoop` persists to disk
   - `Mod-s` (Cmd-S on macOS / Ctrl-S elsewhere) — editor focused, any vim submode — same save action

5. **`@replit/codemirror-vim` standard emulation** — wired in `Viewer.tsx` (`vim()` extension, must load first per `doc/v0-spec.md` §5.1). The app adds no custom vim mappings beyond the `:w` ex-command above — all standard vim keys (`i`/`a`/`o` insert, `v`/`V` visual, `R` replace, `Esc`, `hjkl` motions, operators `d`/`y`/`c`, other ex-commands, etc.) come unmodified from the library. `vim-mode-sync.ts` is not a keybinding — it mirrors the current vim submode into a UI badge (bottom-right of the editor).

6. **Other keydown handlers:**
   - `CommandBar` (`src/components/layout/CommandBar.tsx`) — `Enter` or `Escape` while its input is focused — both currently just close the bar (`setMode('normal')`); no ex-commands dispatched yet (v0 scope)
   - `ChatInput` (`src/components/ai/ChatInput.tsx`) — `Enter` while focused — submits the chat message (no-op if empty/disabled)

No shortcuts exist for the `chat` region itself beyond `ChatInput`'s Enter-to-submit — `activeRegion === 'chat'` only gates styling/focus, not navigation. No Tauri-side (`src-tauri/src`) global-shortcut registrations exist.

**Constraints:**
- This is documentation only — no source files change, no behavior changes.
- The new doc must not duplicate `doc/v0-spec.md`'s architectural narrative; it should link back to `doc/v0-spec.md` §3.4/§5.1/§5.5 for rationale and focus itself on being the exhaustive, scannable key table.
- Standard vim motions/operators (hjkl, i/a/o, d/y/c, etc.) should be acknowledged as "standard `@replit/codemirror-vim` behavior, unmodified" with a link to the library, not re-documented key-by-key — re-authoring a full vim reference is out of scope and would go stale.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `doc/keybindings.md` | New exhaustive, user-facing keybinding reference |
| MODIFY | `README.md` | Add a short "Keybindings" pointer/section linking to `doc/keybindings.md` (only if README has a docs/links section already — see Step 3) |

## Step-by-Step Implementation

> **Step 1 — Create `doc/keybindings.md`**
>
> - **File:** `doc/keybindings.md`
> - **Action:** CREATE
> - **Details:** Write a markdown reference doc with this structure:
>   1. **Title + one-line intro**: "orbit-111 keybindings reference. orbit-111 is vim-first and keyboard-first (see `doc/v0-spec.md` §3.4 for the design rationale behind the two-level vim system)."
>   2. **Section: App-level navigation (works everywhere)** — table of the global chords from Context item 1: `Ctrl-w h`, `Ctrl-w l`, `Ctrl-w c`, `:`, `Escape`. Columns: `Keys | Action | Notes`. Note that `Ctrl-w` arms a 1.5s window for the next key.
>   3. **Section: Sidebar (when focused)** — table of item 2's `j`/`k`/`l`/`Enter`/`h`. Note precondition: only active when the sidebar region has focus and you're in normal mode.
>   4. **Section: Editor** — subsections:
>      - "Region navigation" — note that `Ctrl-w h/l/c` work identically inside the editor (item 3), since CodeMirror is in charge while focused.
>      - "Saving" — `:w` and `Mod-s` (write Cmd-S/Ctrl-S generically, e.g. "`Cmd-S` (macOS) / `Ctrl-S` (Linux/Windows)") from item 4.
>      - "Vim mode" — one paragraph: vim is enabled by default (no toggle yet); standard `@replit/codemirror-vim` keys (insert `i`/`a`/`o`, visual `v`/`V`, replace `R`, `Esc`, motions, operators, ex-commands) all work unmodified — link to the library's own docs/README for the full vim key reference rather than re-listing them here. Mention the live mode indicator badge (bottom-right of the editor) that shows the current vim submode.
>   5. **Section: Chat** — `Enter` in the chat input submits a message (item 6). Note there's no vim-style navigation within the chat region yet; use the app-level chords to move focus to/from it.
>   6. **Section: Command bar** — opened via `:` from normal mode; `Enter`/`Escape` currently both just close it (no ex-commands wired yet in v0). One sentence noting this is intentionally minimal in v0.
>   7. **Footer note**: "This doc reflects the current implementation. Source of truth: `src/hooks/use-global-keymap.ts`, `src/hooks/use-sidebar-keymap.ts`, `src/lib/editor/region-exit.ts`, `src/lib/editor/save.ts`. Update this file whenever a keybinding is added, changed, or removed."
>   - Use GitHub-flavored markdown tables. Keep prose minimal — this is a reference, not a tutorial.
> - **Why:** Centralizes every shortcut in one scannable place; the footer note keeps it from silently going stale.

> **Step 2 — Cross-check against source one more time before finalizing**
>
> - **Action:** Before saving, re-open `src/hooks/use-global-keymap.ts`, `src/hooks/use-sidebar-keymap.ts`, `src/lib/editor/region-exit.ts`, and `src/lib/editor/save.ts` and confirm every key/precondition in the new doc matches the code exactly (key names, modifier requirements, the 1500ms chord timeout value, the exact region cycle order, save keybinding for both macOS and non-macOS).
> - **Why:** This doc's entire value is accuracy — a stale or wrong keybinding table is worse than no doc.

> **Step 3 — Link from `README.md` (only if warranted)**
>
> - **File:** `README.md`
> - **Action:** MODIFY (conditional)
> - **Details:** Read the current `README.md`. If it has any kind of "Docs"/"Learn more"/links section, add one line: `- [Keybindings](doc/keybindings.md)`. If the README is minimal/scaffold-only (e.g. default Tauri template content) with no docs section, **skip this step** rather than inventing a new section — note in the plan's implementation notes that it was skipped and why.
> - **Why:** Makes the new doc discoverable without forcing an unrelated README restructure.

## Architecture Decisions

- **Standalone doc, not a `v0-spec.md` merge.** `doc/v0-spec.md` stays the architectural/decision-log doc; `doc/keybindings.md` is a new, separate, purely-referential doc. Keeping them separate avoids bloating the spec and gives the keybinding table a stable, easy-to-scan home that isn't interleaved with prose about *why* decisions were made.
- **Do not re-document standard vim keys.** Only this repo's own additions (`Ctrl-w` chord, `:w` wiring, `Mod-s`) get full treatment. Re-authoring `@replit/codemirror-vim`'s full keymap would duplicate upstream docs and drift out of sync on every library upgrade.
- **No source/behavior changes.** Per `.agents/commands/planning.md`, this plan produces documentation only.

## Validation Criteria

- [x] `doc/keybindings.md` exists and covers all six inventory groups from the Context section (app-level, sidebar, editor region-exit, editor save, vim mode note, chat + command bar)
- [x] Every key combo, modifier, and precondition in the new doc has been cross-checked against the current source (Step 2) and matches exactly
- [x] The doc links back to `doc/v0-spec.md` §3.4 for rationale rather than re-explaining the two-level vim design
- [x] `pnpm lint` / `pnpm check` still pass (docs-only change, but confirms nothing else was accidentally touched)
- [x] README updated with a link **only if** an existing docs/links section was found (Step 3); otherwise explicitly skipped

## Open Questions

None.

## Implementation Notes

- Step 3 (README link) was **skipped**: `README.md` is the unmodified default Tauri + React +
  TypeScript template (title, "Recommended IDE Setup" section only) with no docs/links section
  to append to. Per the plan's own conditional, inventing a new section was out of scope.
- Cross-checked all six source files (`use-global-keymap.ts`, `use-sidebar-keymap.ts`,
  `region-exit.ts`, `save.ts`, `CommandBar.tsx`, `ChatInput.tsx`) plus `app-store.ts` for the
  region cycle order (`sidebar → viewer → chat`, wrapping) — all match the doc exactly.
  `pnpm check` passes.
