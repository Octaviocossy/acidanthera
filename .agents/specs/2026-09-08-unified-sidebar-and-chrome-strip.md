# Spec: Unified Sidebar and Chrome Strip

> Status: **settled**
> Created: 2026-09-08
> Grilled: 2026-09-08 — 4 rounds, 43 decisions
> Suggested next: /spec-breakdown

## Goal

Restructure the sidebar and the top of the window so they read as one surface: dissolve the
40px `Titlebar` into per-region **chrome strips**, float the editor and agent panel as **inset
cards** on the sidebar's own ground, and give the sidebar a **primary nav**, two-line note rows
and a **footer identity block**. Sourced from two supplied mockups (`4a` dark / `4b` light).

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Which depicted-but-nonexistent data we build | Folder counts plus a new `VaultEntry.modified`; link counts, back/forward and `synced` cut | Counts are already on the wire; mtime is one `fs::metadata` inside a walk that already happens. Link counts are the post-v0 index ADR 0114 priced and refused. `synced` would state something false against `doc/v0-spec.md` §3.3 |
| 2 | The titlebar's fate | Delete `Titlebar`; each region renders its own 40px chrome strip | A spanning component would have to track `--rail-sidebar` itself to keep the seam aligned through expand and collapse — restating a width the sidebar already owns |
| 3 | The window title | Deleted | `hiddenTitle` means macOS draws none either, so the app's name leaves the window entirely. The vault name in the footer is the half that carries information |
| 4 | Editor shell | Inset `--bg-canvas` card at `--radius-panel` on a `--bg-panel` ground | Reproduces the mockup in both themes with no new token, and puts the ladder's load-bearing canvas-vs-panel contrast on directly adjacent surfaces for the first time |
| 5 | Primary nav rows | New note · New folder · Agent | The two that map to real commands, plus New folder so `⊞` is not lost when the header sheds it. `Daily note` is a feature request wearing a nav row; `More` has no destination |
| 6 | Tree or grouped list | Stays a tree; folder rows restyled to look like group headers | The drawing is a two-level list, which cannot represent a vault nested deeper than the shallow one it happens to depict |
| 7 | Chat toggle relocation | Moves out of chrome into the primary nav | **Reverses decision 1 of `.agents/specs/2026-08-09-relocate-the-chat-toggle.md`**, whose premise — ADR 0109 defines the sidebar as a *vault launcher* — died with the titlebar |
| 8 | Panel naming | Renamed **Agent**, in the UI and in region/panel state | Chosen against the recommendation to keep "Chat". Accepts a homonym with the CLI-process `Agent*` vocabulary, resolved by an explicit Flagged Ambiguity rather than by counter-renaming the backend layer to `Engine*` — "engine" was retired as an alias for good reason |
| 9 | Notes-section header controls | Both `⌕` and `···` cut | The brand row already carries find-file, and the primary nav absorbed the create actions a root-scope `···` menu would have duplicated |
| 10 | Brand mark ember ring in-app | Adopted; ADR 0117 superseded | Chosen against the recommendation. Required a decidable replacement rule rather than an exception — see decision 29 |
| 11 | Row status dots | Ember dirty dot kept and named in invariant 21; green cut | The ember dot already ships in `FileTreeItem` and `EditorTabs` and the design skill has always permitted it. Green is not a role in this system — the only green is diff direction (ADR 0105) |
| 12 | Editor bottom status row | Refused entirely — no bar, no `VIEWER` label, no chip | ADR 0107 deleted a bar carrying exactly these passengers, including the region label the focus border already shows; the chrome-weight pass un-boxed the mode and then deleted `Badge` for having no consumers |
| 13 | Persistent chord hints | Yes, on primary-nav rows only; hover `Tooltip` unchanged elsewhere | The nav rows are the app's top-level actions and the mockup's rhythm depends on them. Chords render live via `formatChord`, so `a` and `Ctrl+wc` — not the `⌘N`/`⌘L` literals drawn (invariant 31) |
| 14 | Footer contents and right-hand control | Vault name + `N notes` + `⚙`; `synced` dropped | `⚙` must survive the titlebar's dissolution. A theme toggle beside a `settings.toml` that also owns `theme` invites two disagreeing surfaces |
| 15 | Which design docs get reconciled | Glossary + ADRs in this session; `doc/v0-spec.md` §5.0/§5.3/§5.6 and the `acidanthera-design` skill in the implementation epic | The skill is what reviewers read; adding new rules to a file that still describes a deleted primitive is the worst of both |
| 16 | Sidebar top-strip layout | A separate empty 40px drag strip above the brand row | Gives the drag region the whole strip rather than the gap between a mark and two icons, and keeps the lights off app controls |
| 17 | Traffic lights against the 40px rail | The viewer's strip insets its left edge by `max(0, lights width − sidebar width)` | `trafficLightPosition` is static config with no runtime setter in tauri 2.11.5, so the lights cannot move on collapse. Widening the rail would break the 40px rhythm ADR 0109 decision 17 chose deliberately |
| 18 | Tab strip at zero buffers | Always reserves 40px instead of returning `null` | Keeps the card's top edge level with the brand row so it never slides under the lights; the alternative states one alignment in two places that must agree |
| 19 | Naming | *Chrome strip* and *primary nav*; `--rail-titlebar` keeps its name | A token rename touches both consumers for no behavior change. The glossary records that the token outlived its component |
| 20 | Tab treatment | Detached `--radius-tab` chips on the panel ground | The `-mb-px` / `border-b-canvas` merge has no shared edge left to erase once the card is inset on all four sides |
| 21 | Agent panel shell | Also an inset card; its header aligns with the tab strip | Its 40px header existed only to line up with the titlebar being deleted. Editor and agent then read as two cards on one ground |
| 22 | Focus-region indication | The active card's border steps to `--border-strong` on all four sides | A floating card with one strong side reads as a rendering bug. ADR 0107 leaned on this border when it deleted the region label, which decision 12 declined to restore |
| 23 | Row density | Two-line notes, one-line folders | Gives `modified` a home and makes folders read as the subdued group headers decision 6 needs, without leaving the tree. Costs roughly a third of the visible rows |
| 24 | Nav row icons | `FilePlus` / `FolderPlus` from the existing Lucide set, plus the raw `✦` character | Preserves relocate decision 5: `✦` is a **filled** mark and the house style is a 1.2px outline stroke, so drawing it would change it in kind, not in weight |
| 25 | Agent row open state | Visible `bg-elevated` alongside `aria-pressed` | Relocate decision 8's reasoning was about an isolated 24px chrome button. In a list whose other rows have hover and active states, a toggle that never looks toggled is confusing |
| 26 | Folder row treatment | Muted, with a count, at every depth | One folder appearance in one tree. The top-level-only variant matches a mockup that only draws depth 1 and would create two appearances |
| 27 | `edited` computation | Client-side relative string, recomputed only on watcher-driven re-render | A row may read `3m` slightly past the minute, which nobody notices, and it adds no always-running timer for a cosmetic property |
| 28 | Rename reach | UI and region/panel state; not the wire | `global.toggle-chat` and the `chat.history` layer are user-visible in `keymaps.toml`, and `.acidanthera/chats/` is on disk. Deliberately diverges from ADR 0118, which took the rebrand into the format — that was pre-ship with one machine's state |
| 29 | Replacement for ADR 0117's rule | The brand mark is **identity, not signal**, and is exempt from the accent system; the ring renders wherever the mark renders | ADR 0117's value was a decidable test. Its replacement asks what the element *is* rather than where it is drawn, which is the only form that survives a mark drawn inside the window. Reverses ADR 0109 decision 16 |
| 30 | Collapsed rail contents | Mirrors the nav — `✦` added — with `⚙` pinned at the bottom | Once every global control lives in the sidebar, a control the rail omits has no pointer affordance at all. Amends ADR 0109 decisions 18 and 20 |
| 31 | Drag region | Both chrome strips carry `data-tauri-drag-region="deep"` | At 40px collapsed the sidebar's strip has nothing left to grab. Tabs stay clickable through Tauri's clickable-tag exemption, the same mechanism the old control cluster relied on |
| 32 | Nav rows and the `j`/`k` cursor | Not cursor rows | Keeps the single row source ADR 0108 bought by deleting `sidebar-rows.ts`, along with the synthetic cursor key and per-row routing switch it took with it. Each nav row already has a chord and displays it |
| 33 | `useChordTitle` | Deleted with its test | Both consumers were the titlebar's `✦` and `⚙`; once they move into the sidebar the reveal is the drawn `Tooltip` (invariant 32), leaving the hook with none. Same reasoning that deleted `Badge`. `useCommandChord` stays |
| 34 | Rename boundary | Region and panel move; transcript and persistence stay | `useChatStore`, `useChatHistoryStore`, `ChatItem`, `src/lib/chat/`, `chatsService` and `ChatFile` all name the transcript and its format, which is not being renamed |
| 35 | What the counts count | Notes, recursively, in both folder rows and the footer | One meaning of a number in one panel. Computed client-side from the already-cached tree, so no new IPC; `children.length` would read `2` for a folder holding two note-filled subfolders |
| 36 | Inline naming row height | Full two-line height with the meta line blank | A draft or rename never shifts the list, and a note being named is never given an edit time it does not have |
| 37 | `Notes` label form | `SectionLabel` unchanged, rendering `NOTES` | Deviates from the drawing by one word's letter-case. A per-site override is the drift the chrome-weight pass refused when it changed the `Chip` primitive rather than one call site |
| 38 | Card elevation | Hairline in both themes; no shadow | The card is inset *into* the ground, not elevated above it, so the light-shadow rule does not apply — and its border already has a second job under decision 22 |
| 39 | Footer identity tile | `--radius-item` on `--bg-elevated`, ring on the mark itself | Distinguishes the footer block from the brand row's bare mark. ADR 0122 exempts the *mark*, not a fill behind it; ADR 0105's "never a large fill" still governs `--accent-soft` |
| 40 | Which decisions become ADRs | Chrome strip (0035) and brand mark (0036); the rename recorded in this spec only | The rename's cost is real but its reversal is mechanical, and the reasoning lives in the *Agent panel* glossary row and the Flagged Ambiguity beside it |
| 41 | Focus-gated chords on nav rows | Shown as-is | Already the shipped behavior — the header's `✎`/`⊞` tooltips render `a`/`A` from the sidebar layer today with the same caveat. Promoting them would need duplicate `global.*` ids, since `AppCommandId` is layer-prefixed |
| 42 | Tab anatomy | File icon and `×` on the active tab; inactive name-only with `×` on hover; dirty dot unchanged | Matches the drawing and quiets a strip that currently renders one always-visible `×` per open buffer. The dot and `×` already coexist and nothing here asks them to merge |
| 43 | Nav "New note" placement | Cursor-relative, same as `a` | One command, one behavior however invoked. The sidebar header's existing buttons already work this way, and splitting behavior by invocation path is the divergence invariant 3 warns about |

## Explicitly Out of Scope

- **Back/forward navigation.** The `‹ ›` chevrons in the mockup. There is no navigation history anywhere in the codebase — no router, no command, no stack — and building one is a feature, not a re-skin.
- **`Daily note`.** A nav row for a note-templating feature that does not exist.
- **`More`.** A row with no defined destination.
- **Per-note link counts (`4 links`).** ADR 0114 priced exactly this and refused it: a full read of every note in the vault, uncached, per computation. The index belongs to the post-v0 graph.
- **`synced` in the footer.** `doc/v0-spec.md` §3.3 makes v0 zero-auth, zero-sync. The word would be false.
- **The green status dot.** No meaning it could carry ("saved", "clean", "synced") is worth a third colored fill against invariant 27.
- **A bottom status bar, the `VIEWER` region label, and the boxed `NORMAL` chip** (decision 12).
- **`⌘`-style chord literals** (decision 13). Rebinding the defaults to `⌘` shortcuts was declined — the app is vim-first and `keymaps.toml` is where a user changes that.
- **Renaming the CLI-process `Agent*` vocabulary to `Engine*`** to dissolve the homonym decision 8 creates. Considered and declined; documented as a Flagged Ambiguity instead.
- **A `sortBy: modified` control.** `modified` arrives on the wire but the sidebar's ordering is untouched — directories first, then case-insensitive name.
- **The duplicate ADR `0034`.** `.agents/adr/` already contained two files at that number before this session (`sidebar-hover-reveal-is-app-drawn`, `vault-root-is-canonical-at-the-boundary`). Seen, reported, not fixed here.
- **Windows and Linux.** ADR 0106's macOS-only scope is unchanged; per-region chrome strips do not make it worse or better.

## Glossary Changes

Written inline to `.agents/ubiquitous-language.md` during the session (`Last updated` → 2026-09-08, two Changelog rows).

**New terms:** *Chrome strip*, *Primary nav*, *Agent panel*, *Inset card*, *Footer identity block*, *Note row*.

**Rewritten:** *Titlebar* → *Chrome strip*; *Chat toggle* → *Agent panel*; *Traffic light inset* (the band is the sidebar's strip, and the missing runtime setter now explains the tab-strip inset); *Sidebar rail* (gains `✦` and a pinned `⚙`, and its mark carries the ring); *Chord hint* (`useChordTitle` and the native-`title` path are gone).

**Amended:** *AI accent* and invariant 21 (brand-mark exemption; the dirty-note dot named as the one permitted status indicator, ending a standing contradiction with the shipped code); *Icon*; invariant 27; *Focus region* and *Region visibility* (`'agent'`, `agentOpen`); *Vault entry* (`modified`); *Sidebar row*; *Vault display path*; *Editor status cluster*; invariants 1, 23, 24, 31, 32.

**New ambiguity:** *Agent panel versus agent process*.

## ADRs Raised

- `.agents/adr/0121-chrome-strip-replaces-the-titlebar.md` — the titlebar dissolves into per-region chrome strips. Amends ADR 0106's consequences and finishes ADR 0107's chrome-host premise, which ADR 0109 had half-superseded.
- `.agents/adr/0122-brand-mark-is-identity-not-signal.md` — supersedes ADR 0117, reverses ADR 0109 decision 16.

## Residual Unknowns

Three items settled in principle but requiring confirmation in the running app, recorded as validation steps rather than open questions:

1. **The traffic-light clearance constant.** Decision 17's inset needs a real measurement of the light cluster's right edge, exactly as `.agents/specs/2026-08-15-center-the-traffic-lights.md` had to measure `x` — where the assumed value (20) turned out to be wrong (9 / 15.5).
2. **Two-line row height at 224px.** Decision 23 costs about a third of the visible rows. Whether that trade holds is a judgement only the running app can settle.
3. **Window dragging across two strips.** Decision 31 splits the drag region for the first time. The glossary already flags dragging as verifiable only in the app, never in a unit test.
