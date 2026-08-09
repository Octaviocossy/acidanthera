# Spec: Collapsible sidebar rail

> Status: **settled**
> Created: 2026-08-08
> Grilled: 2026-08-08 — 3 rounds, 25 decisions
> Suggested next: /create-issue

## Goal

Make the sidebar always visible — collapsing to a 40px icon rail instead of unmounting — so its own
expand/collapse control can live inside it, and move the `⌕` find control out of the titlebar into
that rail. Remove the pinned Config section from the sidebar; `settings.toml` and `keymaps.toml`
stay fully editable but are reached only through the file finder.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | What renders in the collapsed rail | Action icons **plus** one icon per vault root entry | A rail of chrome alone wastes the space; the root entries make it a launcher |
| 2 | Does a fully-hidden state survive? | No — boolean means *expanded ↔ collapsed*, never hidden | A tri-state needs a third gesture and nothing asks for one |
| 3 | Is a collapsed rail a reachable `FocusRegion`? | No — reachability keys on *expanded*, not *visible* | There is no chord that focuses the sidebar directly, only `ctrl-w l`/`h` cycling; auto-expanding on focus would fire every time you cycle past |
| 4 | What stays in the titlebar | `⚙` settings stays; `⌕` and the re-show control leave | Only the finder was asked to move |
| 5 | Scope of the Config removal | Delete `sidebar-rows.ts` entirely; both consumers return to `flattenVisibleTree` | One row source again — the `a`/`A` non-vault guard and the draft-splice hazard go with it |
| 6 | How the Config removal is recorded | New ADR 0010 + a superseded note on ADR 0004's first consequence | 0004's core decision still holds; only its sidebar half died |
| 7 | Where the expand/collapse button lives | Sidebar header, in both states | Keeping it on nearly the same pixel is what makes the gesture feel reversible |
| 8 | Is the collapsed state persisted? | No — ephemeral, resets to expanded on launch | Persisting means a new `settings.toml` key, default, diagnostic and migration |
| 9 | Does `Ctrl-w b` change? | Same chord, same command id `global.toggle-sidebar`; new meaning | No existing `keymaps.toml` breaks |
| 10 | What a click on a rail entry does | Asymmetric: directory → expand + unfold + cursor; file → open, rail stays collapsed | A directory has nothing to show at 40px; a file does not need the tree back |
| 11 | Which entries appear in the rail | All direct children of `vaultRoot` — directories *and* notes | A root note is as navigable as a folder; filtering it would need explaining |
| 12 | Rail overflow | `overflow-y-auto` on the entries block; action icons pinned above | A silent cap hides entries without saying so |
| 13 | Telling identical glyphs apart | Native `title` with the entry name | Matches the six existing icon-buttons; no tooltip primitive exists in the repo |
| 14 | Editor state shown in the rail | Active buffer only (`bg-elevated`); no dirty dot | At 40px the amber dot fights the glyph, and it is already an inherited exception to ADR 0007 |
| 15 | The titlebar's now-dead "Show sidebar" button | Deleted, with its test, its `ml-[78px]` offset, and `ChevronRightGlyph`'s old call site | The rail is always there; a second control for the same gesture on another surface is noise |
| 16 | Replacement for the `VAULT` label | Decorative placeholder orbit mark, monochrome | ADR 0007 reserves `--accent` for AI agency, so a brand mark may not carry it |
| 17 | Collapsed rail width | 40px (`--rail-sidebar-collapsed`) | Keeps the 40px rhythm `--rail-titlebar` and `--rail-fab` already set; squares the top-left corner |
| 18 | Action icons in the collapsed rail | `⌕`, `✎`, `⊞` — the two create actions expand first, then start the draft | `EntryDraftRow` needs a visible tree row to render into |
| 19 | Rail with no vault open | Mark + toggle + `⌕`; `Open vault…` only when expanded | Create actions are already gated on `vaultRoot`; the toggle is one click away |
| 20 | The `displayPath` footer when collapsed | Hidden | No room for a truncated path at 40px |
| 21 | The find icon's form | New drawn `SearchGlyph` SVG, replacing the raw `⌕` character | The Unicode character sits at a different weight next to `NewNoteGlyph`/`NewFolderGlyph` |
| 22 | Width transition | Instantaneous, no animation | Animating width reflows CodeMirror every frame |
| 23 | Is the rail itself ADR-worthy? | Yes — ADR 0011, plus an amendment note on ADR 0009 | It supersedes 0009's "only always-visible chrome host" premise |
| 24 | State naming | `sidebarOpen` → `sidebarExpanded`; `openSidebar`/`closeSidebar` → `expandSidebar`/`collapseSidebar` | Keeping "open" would make invariant 1 literally false |
| 25 | Implementation routing | One GitHub issue | ~12 files, one observable behavior — below the 3-slice threshold for an epic |

## Explicitly Out of Scope

- **Persisting the collapsed state** across launches (decision 8). Needs a `settings.toml` key with
  its own default, `SettingsDiagnostic` row and comment-preserving write.
- **A tooltip primitive.** Native `title` is used, as everywhere else in the app. Introducing
  `@radix-ui/react-tooltip` and retrofitting the six existing icon-buttons is its own piece of work.
- **Moving `⚙` out of the titlebar** (decision 4). Noted tension: `⌕` and `⚙` are the same kind of
  control and now live on different surfaces. ADR 0011 records why the rail *could* host it, if that
  is revisited.
- **Animating the collapse** (decision 22).
- **Dirty-buffer indicators in the rail** (decision 14).
- **A `global.focus-sidebar` command** that would expand and focus in one gesture (decision 3,
  rejected option c).
- **Any change to config buffers themselves** — `openConfigFile`, `EditorBufferSource`, save
  routing, TOML highlighting and the finder's `config` chip are untouched.

## Glossary Changes

In `.agents/ubiquitous-language.md`:

- **Region visibility** — rewritten; it no longer describes the sidebar, which is always visible.
- **Sidebar rail** — added: the 40px collapsed state, its contents and its launcher semantics.
- **Sidebar row** — removed (`SidebarRow`, `flattenSidebarRows`, `CONFIG_SECTION_PATH` are deleted).
- **Config entry** — updated: finder-only, never a sidebar row.
- **Titlebar** — updated: loses `⌕` and the sidebar re-show control; keeps the title and `⚙`.
- **Invariant 1** — rewritten: reachability keys on *expanded*, not *visible*.
- **Invariant 24** — added: the sidebar is always visible, and a collapsed rail is not a reachable
  focus region.

## ADRs Raised

- `.agents/adr/0010-config-reachable-only-from-the-finder.md` — Config files are reachable only from
  the file finder
- `.agents/adr/0011-sidebar-collapses-to-a-rail.md` — The sidebar is never hidden; it collapses to a
  rail

Amended: `0004` (first consequence superseded by 0010), `0009` (premise amended by 0011).

## Residual Unknowns

The orbit mark is a **placeholder** until the official one exists (decision 16). Swapping it is a
one-glyph change with no structural consequence.
