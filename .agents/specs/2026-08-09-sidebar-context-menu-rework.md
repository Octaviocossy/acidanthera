# Spec: Sidebar Context Menu — Rework, Rename & Duplicate

> Status: **settled**
> Created: 2026-08-09
> Grilled: 2026-08-09 — 3 rounds, 34 decisions
> Suggested next: /spec-breakdown

## Goal

Rebuild the sidebar context menu to the reworked mockup — seven rows in four grouped sections,
each with an icon and a live shortcut hint — and build the two features it introduces: **Rename**
(which drags the long-deferred wikilink question with it) and **Duplicate**.

## Context that shaped the decisions

Five facts, established by exploration before any question was asked:

1. **The mockup contradicts three settled rulings.** Invariant 27 and ADR 0015 exclude the menu's
   Delete row from `--danger` by name. `.agents/specs/2026-08-09-sidebar-context-menu-elevation.md`
   removed the panel's shadow one commit ago. And the mockup's `⌘N`/`⌘D`/`⌘⌫` do not exist: orbit
   is vim — `a`, `shift-a`, `d d`.
2. **Neither rename nor duplicate exists anywhere.** `vault.rs` exports eight commands, none of
   which moves or copies. `guarded_path` already supplies containment, canonicalization and
   leaf-symlink rejection; `creation_error` already maps `AlreadyExists`.
3. **`[[X]]` means "the file named `X.md`, somewhere in the vault"** — a sentence in
   `templates/vault-agents.md:18`, upheld by no code. There is no parser (the CM6 regex has no
   capture group), no index, no backlinks, and no way to read many notes: `read_note` is one path
   at a time and no `ignore`/`grep`/`walkdir` crate is present. Nothing enforces unique basenames.
4. **`d` is already a prefix.** `resolve.ts` reverts an entire layer to defaults when a chord is
   both a leaf and a prefix, so Duplicate cannot be `d`.
5. **Inline naming already exists.** `EntryDraftRow` (autofocused input, `Enter` commits,
   `Escape`/blur cancels) plus `createVaultEntry`. Rename is a third consumer of that pattern.

## Settled Decisions

### Menu presentation

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Destructive row color | **Red** on glyph and label; ADR 0015 narrowed by ADR 0018 | A destructive row rendered like the six above it is found by reading, not seeing. The token widens by one step — the path, not only the final click — and stops there |
| 2 | Destructive row label | `Move to Trash` | What the `trash` crate actually does (ADR 0012), and already the confirm button's text |
| 3 | Item applicability | **Hide, never disable** | Background (root) → the create pair only; directory → adds Rename/Duplicate/Move to Trash; note → everything. Extends the rule Delete already followed. "Summarize note" is meaningless on a folder |
| 4 | AI rows | Permanently disabled placeholders keeping the **ember `✦`** at disabled opacity | Invariant 21 gains one clause: an AI action *offered but not yet available*. Without the ember the group has no identity |
| 5 | AI rows' registry footprint | **No `AppCommandId`**; `aria-disabled` + native `title="Coming soon"` | Nothing speculative enters `APP_COMMANDS`; there is no tooltip primitive in the repo |
| 6 | `Copy link` | **Not built** | Out of the mockup deliberately — orbit has no link-to-note URI |
| 7 | Shortcut hints | Live chords resolved from `useKeymapStore`, not the mockup's `⌘` labels | They stay true when the user edits `keymaps.toml`. `DeleteEntryDialog` already reads the keymap this way |
| 8 | Hint formatter | Extract `formatChord` to `src/lib/keymap/`, shared with `DeleteEntryDialog` | One label table (`shift-a` → `A`, `d d` → `dd`, `mod-s` → `⌘S`) instead of two diverging ones |
| 9 | Panel chrome | Mockup geometry (~210px, roomier rows, hairline group dividers), **elevation by border only** | The elevation spec from one commit ago stands; `border-border-strong` remains the only cue |

### Icons

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 10 | Icon source | **`lucide-react`** (ADR 0017) | The hand-drawn set was becoming a private icon library. Lucide already matches on `currentColor`, no fill, round caps and joins |
| 11 | Migration scope | The twelve drawn glyphs + the two new ones; `OrbitMarkGlyph` stays hand-drawn; the Unicode characters stay characters | A brand mark is not an icon. `◈ ＋ ✦ ⌕` live inside text and two tests assert the literal character |
| 12 | Stroke normalization | An `Icon` wrapper pinning `strokeWidth={1.2}` + `absoluteStrokeWidth` | Lucide's default renders 1.25px at 15px but 1.0px at the 12px used in tree rows. The wrapper holds the house spec in one file at every size |

### Rename

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 13 | UX | **Inline** on the row, prefilled | A third consumer of the existing pattern; a modal to type a name is disproportionate |
| 14 | Rust contract | `rename_entry(path, newName)`, same parent, path separators rejected | A general `move_entry(from, to)` is more surface with no consumer — moving stays out of scope |
| 15 | Extension | The **stem** is edited; `with_md_extension` reappends `.md`; directories edit their full name | A rename can never turn a note into a non-note and silently drop it from the sidebar |
| 16 | State ownership | A dedicated `renamePath` slot + an inline-input component shared with `EntryDraftRow` | A rename is not a draft; a third `EntryDraftKind` would collapse a distinction the glossary marks |
| 17 | Open buffers | **Rewrite `filePath`** on every buffer at or under the old path, dirty ones included | Closing them is deletion's cost; a rename destroys nothing. A stale `filePath` would recreate the old file on the next `:w` |
| 18 | Cursor | Follows the renamed entry to its new path | Same reasoning as the post-delete cursor rule |

### Wikilinks

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 19 | Rewriting at all | **Yes** — the rename repoints every link to the old stem | The interrogation's one reversal of the previous spec's "out of scope" |
| 20 | Engine | A Rust command scanning on demand; **no index** (ADR 0016) | `v0-spec.md` §5.4 reserves the index for the post-v0 graph. Nothing to invalidate, no watcher coupling. Doing it in TS is 2N IPC round trips per rename |
| 21 | Target grammar | Everything before the first `\|`; `#`/`^` anchors preserved verbatim; comparison **case-insensitive** | Narrower than the CM6 decoration's blind match. macOS's filesystem is case-insensitive, so `Ideas` and `ideas` are one note |
| 22 | Ambiguous basenames | **Rewrite nothing**, rename anyway, toast the reason | Two notes sharing a stem means the link model cannot express which one was meant. Guessing could silently redirect links to the other note |
| 23 | Scan scope | `build_tree`'s filter (no dot-dirs, no symlinks), minus the root `AGENTS.md`/`CLAUDE.md` | The template text contains a literal `` `[[Wikilinks]]` `` that a note of that name would corrupt |
| 24 | Open buffers | Clean buffer → content refreshed in place (stays clean); dirty buffer → untouched + toast | Mirrors `warnDirtyConfigBuffers` and keeps invariants 6 and 17: no unsaved edit is ever discarded |
| 25 | Order and partial failure | Rename first and never rolled back; rewrite best-effort after; toast reports counts and failures | A renamed note with stale links beats a rename that silently un-happens |
| 26 | Confirmation | A modal, shown **only when the scan finds ≥ 1 link** | It consents to writing in *other* notes. `N = 0` — and every directory rename — needs no consent |
| 27 | Dialog body | Count first, then the affected notes listed | The dirty-buffer block of `DeleteEntryDialog`, reused |
| 28 | Dialog buttons | `secondary` confirm, `ghost` cancel | `primary` is reserved for AI (ADR 0007) and `danger` for destruction (ADR 0015). A rename is neither |
| 29 | Deletion | Unchanged — no "N notes link to this" line | Out of scope. It is one line away once the scanner exists |

### Duplicate

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 30 | Scope | Notes **and** directories, via a hand-rolled recursive copy skipping symlinks | Mirrors `build_tree`'s filter; no `fs_extra` dependency for twenty lines |
| 31 | Copy naming | `X copy` → `X copy 2` → `X copy 3`, applied to the stem | Finder/VS Code idiom; `note.md` becomes `note copy.md` |
| 32 | After duplicating | Move the cursor to the copy; open nothing | Duplicating is a filing action, unlike New note, which is an authoring one |

### Keyboard

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 33 | Chords | `sidebar.rename` = **`r`**, `sidebar.duplicate` = **`shift-D`** | `d` is a prefix (`d d`); a `d` leaf would revert the whole sidebar layer to defaults. `DEFAULT_KEYMAPS_TOML` and `doc/keybindings.md` need re-syncing |
| 34 | Decomposition | `/spec-breakdown` — 6 children, 3 waves | Clears the 3–8 threshold with a real dependency graph; two slices write `vault.rs` and must serialize |

## Explicitly Out of Scope

- **`Copy link`.** In the mockup, deliberately not built.
- **Making the AI rows work.** `Summarize note` and `Find related notes` ship disabled, with no
  command ids and no backend.
- **A link index, backlinks, or the graph view.** ADR 0016 chooses a scan precisely to avoid
  building the post-v0 piece early.
- **Rewriting links on delete**, or adding a "N notes link to this" line to the delete summary.
- **Moving entries** — no `move_entry`, no drag-to-move. Rename stays inside its parent.
- **Clicking a wikilink to navigate.** Still does nothing, still shows `cursor: pointer`.
- **Migrating the Unicode characters** (`◈ ＋ ✦ ⌕`) to Lucide, or replacing `OrbitMarkGlyph`.
- **Reinstating the panel shadow.** The mockup shows one; the elevation spec stands.
- **Keyboard navigation inside the menu.** Still mouse-only — every row has a chord.
- **A context menu on the *sidebar rail*.** Unchanged from the previous spec.

## Suggested decomposition

Input for `/spec-breakdown`, not a plan. `vault.rs` is written by B and C, and `glyphs.tsx` by A
and D — the graph serializes both pairs, so no two concurrent branches share a file.

| Wave | Slice | Scope |
|------|-------|-------|
| 1 | **A** — Lucide migration | `lucide-react`, the `Icon` primitive, the twelve glyphs swapped across seven consumers, `glyphs.tsx` reduced to `OrbitMarkGlyph` |
| 1 | **B** — Rust rename + duplicate | `rename_entry`, `duplicate_entry` (+ recursive copy), `vaultService` wrappers, unit tests |
| 2 | **C** — Rust wikilink scan + rewrite | The target parser, `rewrite_wikilinks`, ambiguity detection, scan-scope filter, unit tests. *Depends on B* (same file) |
| 2 | **D** — Menu rework | Four groups, icons, `formatChord` extraction, live hints, hide-not-disable, red `Move to Trash`, disabled AI rows, panel geometry. *Depends on A* |
| 3 | **E** — Duplicate end-to-end | Menu wiring, `shift-D` chord + keymap re-sync, cursor placement. *Depends on B, D* |
| 3 | **F** — Rename end-to-end | `renamePath` + shared inline input, buffer `filePath` rewrite, `RenameEntryDialog`, buffer refresh/warn, toasts, `r` chord + keymap re-sync, `doc/keybindings.md`. *Depends on C, D* |

## Glossary Changes

Written into `.agents/ubiquitous-language.md`; both affected sections carry a marker until the
epic lands.

- **Added:** *vault entry rename*, *vault entry duplication*, *wikilink rewrite*, *rename
  confirmation*, *Icon*.
- **Amended:** *sidebar context menu* (contents, groups, applicability), *destructive color* (a
  third surface), *AI accent* (the disabled-placeholder clause), *Wikilink* (presentation only —
  it defines no target grammar), *Unicode glyph vocabulary* (reduced to characters inside text),
  *design primitive* (`Icon` joins).
- **New ambiguity:** "entry draft versus entry rename".
- **Invariants:** 21 and 27 amended; **28** (a note rename rewrites wikilinks; a directory rename
  does not; ambiguity cancels), **29** (a rename rewrites buffer paths, never closes them —
  the mirror of 26), **30** (icons come from Lucide through `Icon`).

## ADRs Raised

- `.agents/adr/0016-wikilink-rewriting-scans-not-indexes.md`
- `.agents/adr/0017-icons-come-from-lucide.md`
- `.agents/adr/0018-red-marks-the-destructive-path.md` — narrows ADR 0015

## Residual Unknowns

None — the frontier emptied cleanly.

One consequence worth restating rather than discovering during implementation: decision 26 means
the rename dialog needs the link count *before* the rename runs, so the scan is a read-only call
in its own right and the rewrite is a second call after confirmation. A single "rename and rewrite"
command cannot satisfy it.
