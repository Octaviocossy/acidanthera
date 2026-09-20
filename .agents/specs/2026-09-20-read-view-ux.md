# Spec: Read View UX — Code Highlighting, Reading Keys, Content Zoom, Icon Toggle

> Status: **settled**
> Created: 2026-09-20
> Grilled: 2026-09-12 and 2026-09-20 — 6 rounds, 24 decisions
> Suggested next: /spec-breakdown

## Goal

Make the read view a surface that can actually be read and worked in: fenced code carries real
syntax colour in both views, the keyboard reaches the surface at all, text scales to the display,
and the mode control stops spending horizontal space on two words.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Code-block palette | A conventional coloured palette, not the monochrome `--text-*` ladder | A fenced block that reads like prose defeats the point of fencing it |
| 2 | Parser ownership | One shared module `src/lib/editor/markdown-parser.ts`, exporting the configured parser both surfaces use | Today the two views share a parser object only because nobody configured one; invariant 36 needs that to be deliberate rather than incidental |
| 3 | Highlight reach | Both views, and the inline-code chip confined to `InlineCode` | `@lezer/markdown` tags `CodeText` and `InlineCode` alike as `tags.monospace`, so every fenced line currently wears a keycap chip on top of the `<pre>`'s own fill |
| 4 | Hue source | Hand-authored: six desaturated, warm slots, defined in dark and in light | Invariant 22 makes acidanthera names the only token vocabulary, and a borrowed theme imports a second one while resolving only one polarity well |
| 5 | Slot roster | `--syntax-keyword` · `-string` · `-literal` · `-comment` · `-name` · `-builtin` | Measured against the ten curated modes: `typeName` fires in 3 of 10 and `function(variableName)` in 1, while `atom` (9), `definition(variableName)` (7) and `standard(variableName)` (6) were being left out |
| 6 | Grammar source | A registry `info string → parser`, seeded only from `@codemirror/legacy-modes` | Already a direct dependency through TOML, and both paths emit the same `@lezer/highlight` tags, so the palette is unchanged if a Lezer grammar replaces one later |
| 7 | Grammar loading | A curated static subset: ts/js, rust, python, json, yaml, toml, shell, sql, css, html, go, diff | Keeps the walker synchronous, which it must be — it runs inside React render, and a dynamic import renders plain and then flickers |
| 8 | Palette governance | A new invariant 59 bounding the palette to code content, plus a pointer from invariant 27 | Six new hues are the largest change the colour discipline has taken; the boundary is the part that has to be enforceable at the review gate |
| 9 | Unrecognized fence | Renders plain mono | Already what `doc/v0-spec.md` §5.1 promises; no alternative was on the table |
| 10 | Shortcut slicing | The registration defect and the reading verbs ship as separate slices | One is a bug and the other a feature; bundling them hides how small the bug is |
| 11 | Viewer keys | A new `viewer` keymap layer, active with `activeRegion === 'viewer'`, normal mode, and CodeMirror not in front | Makes the verbs rebindable from `keymaps.toml` like every other layer's, instead of a fourth hardcoded handler outside the keymap system (ADR 0130) |
| 12 | Reading verbs | Scroll only — `j`/`k`, `Ctrl-d`/`Ctrl-u`, `g g`, `G` | Wikilink navigation and `/` search both need a cursor model the read view does not have |
| 13 | Layer reach | Read view only; the home surface keeps its current handling | Home rows are a selection model, which imports exactly the cursor problem decision 12 defers |
| 14 | Saving from read | A new `viewer.save` command dispatching `requestSave` | The same `EditorSaveRequest` lifecycle, with no second path and no autosave — invariant 37 forbids both. Precedent: invariant 35, one verb in two layers |
| 15 | Zoom reach | Note content only; chrome stays fixed | Scaling the window would move the 40px chrome strip while the native traffic lights stay put, desyncing `TRAFFIC_LIGHT_CLEARANCE` |
| 16 | Zoom state | One global value in `settings.toml`, with an absent key degrading silently | It is a property of the person and their display, not of the note; a `Field` diagnostic would toast on every existing install at upgrade |
| 17 | Zoom mechanism | `--content-scale` on the root, with the steps content uses redeclared as `calc()` scoped to `.cm-content` and the prose root | Custom properties resolve at the element that uses them, so Tailwind utilities inside pick up the scoped value and neither `theme.ts` nor `ReadView` needs changing |
| 18 | Zoom range | Multiplier 0.8–1.6 in 0.1 steps, default 1.0, with a way back to the default | A multiplier composes with the existing half-pixel ladder instead of re-authoring its eleven steps |
| 19 | Zoom chords | `ctrl-w =` plus `ctrl-w shift-=` to zoom in, `ctrl-w minus` out, `ctrl-w 0` to reset | `Ctrl-w`-prefixed so the existing region-exit gesture reaches both views. A bare `+` chord is unmatchable and a bare `-` throws at parse time — see Residual Unknowns |
| 20 | Zoom discovery | A control in `SettingsDialog` › Editor | Without it nothing in the UI reveals the feature exists |
| 21 | Zoom feedback | The level renders in the *editor status cluster* whenever it differs from 100% | Invariant 23's home for editor state, and the same off-default marker discipline as the dirty-note dot |
| 22 | Toggle shape | Two icon-only ghost buttons, the active one carrying `aria-pressed` and `bg-elevated` | Keeps the control's role as the read view's only mode indicator, which a single toggle loses, and leaves `Segmented` untouched for the settings theme row |
| 23 | Toggle reveal | The drawn `Tooltip`, carrying the label and the live chord of `global.toggle-view` | Removing the labels removes the only affordance, and a native `title` carrying a chord would resurrect the `useChordTitle` pattern invariant 31 declares deleted |
| 24 | Defect scope | In: the dead chords, the save hole, the empty fence, the StyleModule coupling, the stale keybindings doc. Out: the focus-region defects | The five in scope are either the request itself or sit inside code being rewritten anyway; the focus-region model is its own design problem |

## Explicitly Out of Scope

- **The five focus-region switching defects.** `focusRegion` is called by four components but never by the
  `Ctrl-w h`/`Ctrl-w l` cycle; `expandSidebar` and `openAgent` do not set `activeRegion` while
  `collapseSidebar` and `closeAgent` do; `reachableRegions` filters before the modulo, so `h` and `l`
  invert direction when a region is hidden and both become silent no-ops when only the viewer is
  reachable. Real, but a redesign of the region model — its own `/grill`, and blocking nothing here.
- **Wikilink navigation and search in the read view.** Both need a cursor model (decision 12).
- **A user-authored theme system.** Raised during the session and withdrawn. Nothing here pre-commits
  to a contract: `--syntax-*` are private tokens, `ThemeName` stays the closed `'dark' | 'light'`, and
  `CONFIG_FILES` keeps its two-name allowlist. When that work happens, the rule to carry forward is
  that an invariant governs the *meaning* of a slot and never its value — how invariant 21 already
  treats ember.
- **Inner-language highlighting for inline code.** `parseCode` wraps only `CodeBlock` and `FencedCode`;
  `InlineCode` stays plain, which decision 3 depends on.
- **A toolbar for the editor.** Still unbuilt, still out (`doc/v0-spec.md` §5.1).

## Glossary Changes

Staged, not written: a term enters when its code lands (ADR 0127), so the work that implements this
spec promotes these rows in the same commit that makes them true.

| Term | Canonical type | Aliases to avoid | Notes | Destination file |
|------|----------------|------------------|-------|------------------|
| Syntax palette | `--syntax-keyword` / `-string` / `-literal` / `-comment` / `-name` / `-builtin` (`src/styles/tokens/colors.css`) | code colors, "the theme", token colors | Six-slot ramp colouring code **content** in both views, and the app's third colour family after ember and `--danger` (ADR 0131). Chosen by what the parsers emit, not by convention: `-literal` merges `number` with `atom`, `-name` merges `definition(variableName)` with `typeName`, and `typeName`-alone and `function(variableName)` were rejected as near-dead. Operators, punctuation and plain identifiers stay on the *text ladder*. Bounded by invariant 59. | `.agents/ubiquitous-language.md` |
| Fence language registry | `src/lib/editor/markdown-parser.ts` | code languages, the parser map | The `info string → Parser` map handed to `@codemirror/lang-markdown` as `codeLanguages`, seeded from `@codemirror/legacy-modes` and consumed by **both** views through the one shared module (invariant 36). Static and curated, never dynamically imported: the *markdown walker* runs inside React render and cannot await. Distinct from the walker, which renders a tree it does not configure. | `.agents/ubiquitous-language.md` |
| Viewer layer | `'viewer'` in `KeymapLayer` (`src/lib/keymap/defaults.ts`) | viewer region, read layer | The fifth *keymap layer*, sitting between `chat.history` and `global` in `LAYER_PRECEDENCE`, active only while the *read view* is showing — not on the *home surface*, whose rows are a selection model. It is what finally gives the `viewer` *focus region* a layer; the region itself is unchanged and the *read view* is still not a fourth region (invariant 20). Does not swallow (ADR 0130). | `.agents/ubiquitous-language.md` |
| Content zoom | `--content-scale`, `contentZoom` in `Settings` | zoom, font size, app zoom | One global multiplier, 0.8–1.6, scaling **note content only** — the editor text and the *read view*'s prose — never chrome (ADR 0132). Persisted in `settings.toml`, and the one settings key whose absence degrades **silently**, because a `Field` diagnostic would toast on every existing install at upgrade. Applied by redeclaring the content steps of the type scale as `calc()` inside the two content roots, so no component reads it. | `.agents/ubiquitous-language.md` |

**Rows to amend when the code lands:**

- `View toggle` — two icon-only buttons, not `Segmented`; gains a drawn `Tooltip` and renders its chord.
- `Markdown walker` — "GFM is never configured here" is no longer true of the shared module; note that
  the walker now also mounts the *fence language registry*, and that its highlight classes no longer
  depend on a `BufferEditor` being mounted beside it.
- `Keymap layer` — the enumeration becomes five layers, and `LAYER_PRECEDENCE` gains `viewer`.
- `Editor status cluster` — carries the *content zoom* readout while it differs from 100%.
- `Tooltip` — no longer scoped to the sidebar.
- `App command` — the "three paths" claim becomes true rather than aspirational, and the catalog gains
  `viewer.*` and the zoom ids.
- `Settings` — gains `contentZoom`, and its silent-default exception.
- `Read view` — its only write now reaches disk, via `viewer.save`.
- `Markdown highlight style` — it colours code tokens now, not only markdown prose.

**Invariants:**

- **59, new** — the *syntax palette* appears only inside code content, in both views, and never in chrome.
- **32, amended** — the drawn `Tooltip` is no longer sidebar-scoped; the viewer's *chrome strip* is its
  first consumer outside it, citing ADR 0120 for why the reveal is drawn rather than native.
- **27, pointer** — its "exactly two colored fills" clause gains a reference to invariant 59 so it does
  not read as contradicted.
- **37, made true** — today the read view's task toggle dirties a buffer that nothing can save from that
  surface. Decision 14 is what turns the claim into fact; the invariant's wording does not change.
- **31, unchanged but newly exercised** — the *view toggle* becomes the second surface to render a chord
  from the resolved keymap, and the first to do it in a hover reveal.

## ADRs Raised

- `.agents/adr/0130-viewer-region-gains-a-keymap-layer.md` — The viewer region gains a keymap layer
- `.agents/adr/0131-syntax-palette-is-encoding-not-signal.md` — The syntax palette is encoding, not signal
- `.agents/adr/0132-zoom-scales-content-not-the-window.md` — Zoom scales content, not the window

A fourth was offered and declined: widening the `Tooltip` beyond the sidebar is an amendment to
invariant 32 citing ADR 0120, not a decision of its own.

## Residual Unknowns

- **A stream mode that fails to advance takes down the whole document parse.** `readToken` throws
  `"Stream parser failed to advance stream."` after ten non-advancing iterations, and the exception
  propagates out of the *markdown* parse, not just the fence. Whether the registry guards each parser
  or trusts the twelve curated modes is an implementation call this spec does not make.
- **The six hue values are not chosen.** Decision 4 settles that they are hand-authored, warm and
  desaturated, in both themes; the actual values are design work during implementation.
- **Whether `--syntax-name` reads well in TypeScript.** It merges `definition(variableName)` with
  `typeName`, which in TS occur densely and adjacently. The merge is right by coverage; if it reads as
  noise once the palette exists, splitting it is a one-token change.
- **`ctrl-w =` does not spell what the user presses.** The chord is correct — `matchesChordStep` demands
  an exact modifier set, so a bare `+` never matches a `Shift-=` event — but `keymaps.toml` will show
  `ctrl-w =` for a key most people call plus. Whether the seed comments explain that is open.
