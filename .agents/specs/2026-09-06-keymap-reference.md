# Spec: Keymap Reference

> Status: **settled**
> Created: 2026-09-06
> Grilled: 2026-09-06 — 3 rounds, 14 decisions
> Amended: 2026-09-06 — decision 12 partitioned by ADR 0034 (concurrent sidebar-tooltip work)
> Suggested next: /create-issue

## Goal

Give the app a surface that shows every keybinding it actually resolves, so a user can answer
"what key does this?" and "why didn't my rebind take?" without reading `keymaps.toml` or the
source — and stop the eight chrome controls that hardcode a chord as a string literal from
contradicting it.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Where the reference lives | A **Keymaps** category in `SettingsDialog`, beside Appearance/Editor/Vault | The left-nav, the 760px panel, `Ctrl-w s` and the titlebar button already exist — one `CATEGORIES` entry and one render branch, zero new machinery. *Sidebar* is already canonical (`FocusRegion 'sidebar'`, the vault explorer, the *sidebar rail*), so the shape the request first reached for was taken |
| 2 | Not a fourth focus region | Rejected | Would mean rewriting `reachableRegions`, the `Ctrl-w h/l` cycle and invariants 1 and 24 for a table that is read and dismissed. ADR 0009 exists to interrupt exactly this reflex |
| 3 | Read-only, not a rebinding UI | Read-only, with one control that opens `keymaps.toml` as a config buffer | ADR 0003 leaves the file authoritative and ADR 0005's own consequence says the seeded, fully-commented catalog *is* the rebinding UX. A UI writer would be a second writer |
| 4 | Which layers appear | All four of `KEYMAP_LAYERS` — `global` (7), `sidebar` (9), `chat.history` (3), `modal` (2) | Iterating the layer list means a command added later appears for free; curating a subset means the next command in a hidden layer silently never shows. The `modal` pair genuinely answers "what dismisses this dialog" |
| 5 | Editor and vim keys | `resolved.editor` in as its own section; the `@replit/codemirror-vim` keymap **out**, with one line of copy that also names `:w` | `resolved.editor` is real resolved data and `editor.save` is the most-looked-up binding in the app. The vim keymap lives in a dependency, is in no catalog of ours, and any hand-written list would rot silently with nothing in the build able to catch it |
| 6 | Row content | Label (primary) + dotted command id (muted mono) + chords (`Kbd`, right-aligned) | `APP_COMMANDS` already carries `label`, documented as "for a future rebinding UI". The dotted id is the literal a user types into `keymaps.toml`, so dropping it makes a read-only reference a dead end |
| 7 | One chord or all | **All** — via a new `formatChords` sibling in `format-chord.ts` | `sidebar.open` is bound to `l` *and* `enter`; showing one is lying by omission on the surface built to tell the truth. Widening `formatChord` was rejected: its three consumers (`SidebarContextMenu`, `DeleteEntryDialog`, `RenameEntryDialog`) deliberately want a single compact hint |
| 8 | Diagnostics | `resolved.diagnostics` rendered at the top of the section when non-empty, in the shape `SettingsDialog` already uses for the `settings.toml` syntax error | Today they are a boot toast, gone in seconds. This is where someone goes looking after a rebind didn't take. Monochrome with a border step — invariant 27 keeps `--danger` off a failure |
| 9 | Override and unbound rows | Show the default that was displaced (`was Ctrl+wf`); an unbound command reads an em-dash plus `unbound (was …)` | Uses the existing *text ladder* only, so no new visual role enters the system — invariants 21 and 27 leave the app exactly two colored fills (ember = the AI acted, red = this click destroys) and "you rebound this" is neither. It also answers the real question rather than only flagging that a row differs |
| 10 | The edit control | A `secondary` `Button` reading "Edit keymaps.toml", top-right of the Keymaps section body; it **closes the dialog**, then calls `openConfigFile` | `openConfigFile` calls `focusEditor`, which moves the region to `'viewer'` and claims DOM focus (invariant 20) — leaving the dialog open would make the two fight. Section-local rather than in the shared header, which the other three categories would otherwise inherit |
| 11 | Naming | Nav "Keymaps"; headings Global · Sidebar · Chat history · Editor · Dialogs; glossary term *keymap reference* | Matches `keymaps.toml` and the existing *chord* / *keymap layer* / *resolved keymap* family instead of introducing "shortcut" as a third synonym. The dotted ids on every row already carry the file's literal section names, so the headings need not |
| 12 | The nine hardcoded chords | Fixed via `useCommandChord` / `useChordTitle` hooks — but **partitioned** by ADR 0034: this work takes the titlebar's 2 native `title`s and `Viewer`'s `<Kbd>`; the sidebar's 6 belong to the concurrent tooltip work | All nine have been wrong for anyone who edits `keymaps.toml` since #97 shipped rebinding. A `commandId` prop on `Button` was rejected: it would make a *design primitive* read a store, which the glossary defines them as never doing. **Hooks, not plain functions** — a `getState()` read during render would not re-render on a `keymaps.toml` live-reload, reintroducing the same staleness one level deeper |
| 14 | Ownership of the sidebar's six | Handed to `.agents/specs/2026-09-06-sidebar-tooltip-primitive.md` (ADR 0034) | A concurrent `/grill` session settled that the sidebar's six chord-bearing controls render label-plus-`Kbd` inside a drawn *Tooltip* rather than a native `title`. Both halves honor invariant 31, which fixes the chord's **source** and says nothing about its rendering. Claiming them here would collide with work already specified |
| 13 | Invariant numbering | New app invariant **31**; the scaffold block renumbered **32–49**, with its four internal cross-references updated | App invariants ran 1–30 and the vendored scaffold block took 31–48, leaving a new app invariant nowhere clean. Correct ordering was preferred over the zero-churn alternative of appending out of sequence |

## Explicitly Out of Scope

- **Rebinding from the UI** — chord capture, live conflict preview, a `toml_edit` write path. `keymaps.toml` stays the single writer (ADR 0003).
- **The vim keymap** (`hjkl`, `dd`, `y{motion}`, …). It belongs to `@replit/codemirror-vim`; one line of copy says so.
- **A command palette.** The request was to *see* the keymaps, not run them. A searchable palette was considered as the surface and rejected as scope creep.
- **Per-row colour for the override marker.** Deliberately text-ladder only.
- **A fourth `FocusRegion`.** Considered, and rejected against invariants 1 and 24.
- **`editor.next-tab` / `editor.previous-tab` / `editor.close-tab`.** Not excluded by hand — `resolveKeymap` diagnoses them as "isn't rebindable yet" and they never reach `ResolvedKeymap`, so reading the resolved keymap excludes them by construction.

## Glossary Changes

Written inline to `.agents/ubiquitous-language.md` during the session (`Last updated` bumped to
2026-09-06, Changelog row added, section marked settled-ahead-of-implementation):

- **Added** *Keymap reference* — the Keymaps category, its content, its read-only ruling, its row states, and why it is not a focus region.
- **Added** *Chord hint* — the three-way `formatChord` / `formatChords` / `chordTitle` distinction, and why widening `formatChord` was rejected.
- **Added invariant 31** — every user-facing chord comes from the resolved keymap; none is a string literal.
- **Renumbered** the scaffold block's invariants 31–48 to 32–49, updating its four internal cross-references (33→34, 37→38, 36→37 twice). Historical Changelog rows keep their original numbers by design — they are record, not definition.

## ADRs Raised

None.

Each decision was tested against `adr.md`'s three-part rule and none passes it. Surface, naming
and row treatment are each a one-file diff to reverse, so they fail "hard to reverse". The only
real candidate — *read-only rather than a rebinding UI* — **applies** ADR 0003 (the config file
is authoritative) rather than deciding something new, the same reasoning already recorded for the
accent-in-chrome rule under ADR 0007. *No chord is a string literal* is obviously right once
stated, so it fails "surprising without context" and became invariant 31 instead.

## Residual Unknowns

None. The frontier emptied cleanly.

One pre-existing defect was surfaced rather than left unknown: **nine** sites have hardcoded a
chord as a string literal since #97 shipped rebinding, and none reads `useKeymapStore` —
`Titlebar` ×2, `Sidebar` ×6 (eight native `title`s) plus `Viewer`'s empty-state `<Kbd>`.
Decisions 12 and 14 split them: this work takes the titlebar's two and `Viewer`'s one, and the
concurrent tooltip work (ADR 0034) takes the sidebar's six. Note `Viewer.test.tsx` asserts
`getByText('Ctrl-w f')` and will need updating with it.
