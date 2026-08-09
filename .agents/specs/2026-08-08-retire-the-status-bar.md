# Spec: Retire the status bar

> Status: **settled**
> Created: 2026-08-08
> Grilled: 2026-08-08 — 3 rounds, 15 decisions
> Suggested next: /create-issue
> Issue: #112 — https://github.com/Octaviocossy/orbit-111/issues/112

## Goal

Delete the 24px bottom status bar. Editor state (`ln · col`, vim mode) renders inside the
editing surface; global controls (sidebar re-show, find, settings) move into the titlebar,
which is promoted from a passive label to the app's chrome host.

## Context

`src/components/layout/StatusBar.tsx` carries six passengers, and every one is duplicated,
misplaced, or noise:

| Element | What it really is | Verdict |
|---|---|---|
| `VIEWER` | `activeRegion` | Redundant — the focused region already draws `border-border-strong` |
| `ln 17 · col 32` | `useEditorStore.cursor` | Misplaced — editor state belongs in the editor |
| `SIDEBAR` | `toggleSidebar` | Misplaced — belongs on the sidebar |
| `FIND` | `useFileFinderStore.show` | Homeless — the bar is its only mouse path |
| `SETTINGS` | `openSettings` | Duplicated — the sidebar footer cog already does it |
| `NORMAL` badge | **`GlobalMode`**, not vim mode | Reads as a duplicate of the vim badge 36px above |

Two findings reshaped the original brief:

1. **The two `NORMAL` badges are different state machines.** `Viewer.tsx:76-80` renders
   `EditorVimMode` (per-buffer: `normal|insert|visual|replace`); `StatusBar.tsx:50` renders
   `GlobalMode` (app-level: `normal|command`). Invariant 2 already forbids merging them. Two
   identical `<Badge tone="muted">` for two different concepts is the real defect — the brief's
   "the vim mode is repeated" was describing a symptom of it.
2. **A collapse button inside the sidebar is a one-way door.** `closeSidebar` makes `Sidebar`
   return `null`, so no control survives to re-show it. Something outside the sidebar must
   exist, or `Ctrl-w b` becomes the only way back.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Fate of the bottom bar | Delete `StatusBar.tsx` outright | A bar kept "for the orphans" silently re-accumulates chrome; `StatusBar` is a pure leaf with no effects, hooks, layers, or tests, so deletion is mechanically free |
| 2 | Where `ln · col` goes | Bottom-right inside the editor, one line with the vim badge | One status cluster, one place to look; no interaction with `EditorTabs`' `overflow-x-auto` scroller |
| 3 | Sidebar collapse | `⟨` trailing in the sidebar header | Matches the brief: the control for the sidebar lives on the sidebar |
| 4 | Sidebar re-show | `⟩` in the titlebar, rendered **only while hidden** | Closes the one-way door with one control visible at a time — not a permanent duplicate |
| 5 | Mode indicators | Keep only the editor vim badge | `CommandBar` already renders itself whenever `mode === 'command'`, so the command line *is* the `GlobalMode` indicator and `normal` is the silent default |
| 6 | `find` | Permanent `⌕` in the titlebar | It searches vault *and* config files (`collectConfigCandidates`), so it is app-global, not vault-scoped — the sidebar header would misrepresent it |
| 7 | `settings` | Move to the titlebar; **remove** the sidebar footer cog | The cog is gated on `vaultRoot !== null` *and* on the sidebar being visible; one always-reachable home beats two conditional ones |
| 8 | Titlebar layout | Sidebar control left, `⌕`/`⚙` right, title absolutely centered | The re-show control sits on the side it points at; absolute centering stops the title drifting as the conditional control appears |
| 9 | `cursor` scope | Stays global on `useEditorStore`, gated on `activeBufferId !== null` | `BufferEditor.tsx:67` re-syncs on activation so it is never wrong while a buffer is active; per-buffer would change `EditorCursor`'s contract for no visible payoff |
| 10 | `VIEWER` readout | Dropped entirely, not relocated | The focused region's own border is a better indicator than a word in a far corner |
| 11 | `~/` path bug | Fixed; extract the regex once into `displayPath` | `Sidebar.tsx:184` and `Viewer.tsx:70` prepend a literal `~/` to the full absolute path, rendering `~/Users/ovct/Documents/…`; `SettingsDialog.tsx:189` already has the correct regex — a third copy is not acceptable |
| 12 | Glyphs | `⌕` as Unicode, a new drawn chevron, `CogGlyph` redrawn with real teeth | `⌕` is already the canonical search glyph; `CogGlyph` (`glyphs.tsx:142-160`) is a circle plus eight radiating strokes with no teeth, which reads as a sun — moving settings to the titlebar puts that defect front and centre |
| 13 | Sidebar header order | Collapse chevron trailing, after the two create buttons | Create actions stay grouped; collapse sits nearest the edge it collapses toward |
| 14 | Titlebar drag region | `data-tauri-drag-region` stays on the `<header>`, never on the buttons | Tauri matches the attribute on the event target, so child buttons stay clickable — the one behavior that must be verified in the running app, not a unit test |
| 15 | ADR | Write `0009-no-status-bar.md` | Passes all three tests in `adr.md` |

## Explicitly Out of Scope

- **The chat panel's toggle.** `AiFab` is untouched — no symmetry pass over chat chrome.
- **Per-buffer cursor.** `EditorCursor` stays a single global `{line, col}`.
- **`CommandBar` commands.** It still defines none; making `:` reach find/settings is separate work.
- **Keymap changes.** `Ctrl-w b`/`f`/`s` are unchanged; this work moves mouse affordances only.
- **Cross-platform titlebar.** ADR 0008's macOS-only decision stands; adding controls to the
  titlebar does not widen that debt, it rides on it.

## Glossary Changes

Terminology is settled ahead of implementation, matching the precedent set by the config-files
and design-system interrogations; the Cross-cutting section carries a marker until the work
lands. Added or sharpened in `.agents/ubiquitous-language.md`:

- **Editor status cluster** — new term for the bottom-right in-editor overlay.
- **Titlebar** — sharpened: now the app's chrome host, not only a label.
- **Global mode indicator** — new term recording that `CommandBar`'s presence is the only one.
- **Vault display path** — new term for `displayPath`.
- **Invariant 23** — no bottom bar; editor state in the editor, global controls in the titlebar.
- **Flagged ambiguity** "Global versus editor Vim mode" — amended: only the editor one renders.

## ADRs Raised

- `.agents/adr/0009-no-status-bar.md` — orbit deliberately has no status bar.

## Residual Unknowns

None. The frontier emptied cleanly.
