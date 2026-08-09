# Spec: Sidebar Context Menu — Create & Delete

> Status: **settled**
> Created: 2026-08-09
> Grilled: 2026-08-09 — 4 rounds, 19 decisions
> Suggested next: /spec-breakdown

## Goal

Give the sidebar a right-click menu offering New note, New folder and Delete, so vault entries can
be created against the row the user pointed at — and, for the first time, removed from inside the
app at all.

## Context that shaped the decisions

Four facts, established by exploration before any question was asked:

1. **No context-menu, popover, dropdown or portal primitive exists.** `src/components/ui/` holds
   six primitives; `onContextMenu` appears zero times in `src/`. Every overlay is an
   `absolute inset-0` sibling inside `Layout`'s `relative` row.
2. **No delete exists in the vault backend.** `vault.rs` exports seven commands, none destructive;
   the only `fs::remove_file` in production code is `chats::delete_chat`. No trash crate is in
   `Cargo.lock`.
3. **Creation already has a settled parent-resolution rule** — `resolveDraftParent` — shared by the
   keyboard and both mouse entry points. The menu is a third caller, not new logic.
4. **The `modal` keymap layer is defined, resolved and guarded by `applyModalLockoutGuard` — and
   has never had a consumer.** Worse, `dispatcher.ts:168–175` *skips* a non-matching active layer
   rather than swallowing, so region chords have been live under every dialog's scrim since #97.
   A delete confirmation would have inherited that bug for its own `d d` chord.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Menu rendering | App-drawn React overlay in `Layout`, at click coords, viewport-clamped | Native `Menu::popup` is untestable in jsdom, un-themeable, and needs a two-language round trip per action (ADR 0013). It must not mount in `Sidebar` — `overflow-y-auto` inside an `overflow-hidden` row would clip it |
| 2 | Where a deleted entry goes | OS trash via the `trash` crate; never `fs::remove_*` | Orbit's content is hand-written notes and there is no undo (ADR 0012) |
| 3 | Menu contents | Uniform **New note / New folder / — / Delete**, reusing `resolveDraftParent` verbatim | Directory → create inside, file → create beside, background → create at vault root; Delete omitted on background. No new parent-resolution rule enters the codebase |
| 4 | Right-click and the cursor | Menu carries an explicit `target: string \| null`; right-clicking a row also sets `cursorPath` + `focusRegion('sidebar')`; background leaves the cursor alone and targets the root explicitly | One visible selection, so there is no ambiguity about what Delete will hit |
| 5 | Collapsed *sidebar rail* | No context menu — expanded sidebar only | 40px glyphs identified by hover tooltip alone; ADR 0011 frames the rail as a launcher, and it has no draft row to render a create into |
| 6 | Open buffers on delete | Close every buffer at or under the deleted path; dirty ones named in the confirmation; confirming discards their edits | `closeBuffer` is by id only and the watcher never touches buffers, so a new path-scoped close is needed. `source: 'config'` buffers are never affected |
| 7 | Confirmation gate | Always, body adapting to folder counts and dirty-buffer names | Delete sits directly under New folder, so a slip is plausible — and the dirty-buffer discard has nowhere else to be disclosed |
| 8 | The dead `modal` layer | Wake it, and add **swallow semantics**: `'modal'` first in `LAYER_PRECEDENCE`, absorbing every keydown while active | Fixes the leak properly instead of adding a fourth hardcoded dialog (ADR 0014) |
| 9 | Menu dismissal | `Escape`, outside `mousedown`, scroll, window blur | The conventional set; a native menu would have handled these for us |
| 10 | Menu keyboard navigation | **None** — mouse-only | Every item already has a chord, and `FileTreeItem` has no `tabIndex` by design (two biome suppressions record that keyboard is region-scoped, not per-row DOM focus) |
| 11 | Keyboard parity for delete | `sidebar.delete` bound to **`d d`** | Two keys, so no stray keystroke starts a delete. `DEFAULT_KEYMAPS_TOML` in `config.rs` must be re-synced |
| 12 | Menu state ownership | Dedicated store, mirroring `file-finder-store.ts` | A transient overlay with a target is exactly that store's shape |
| 13 | Confirmation state ownership | Module-level promise-shaped subscribable, mirroring `useVaultSwitchPrompt` | Already the app's pattern for gating a destructive action; lets `deleteVaultEntry` read linearly instead of inverting into callbacks |
| 14 | Rust command contract | One `delete_entry(path) -> VaultResult<()>`; add `VaultError::NotFound`; explicitly reject the vault root | `trash::delete` treats files and directories identically. `guarded_path`'s `starts_with` is reflexive, so the root would otherwise pass |
| 15 | Destructive affordance | **No color** — a hairline rule above Delete; the dialog is the affordance | ADR 0007 reserves the accent for AI agency, and `ToastHost` already conveys "error" without color. A `--danger` token adds a third color semantic for one already-gated item; the diff red means "removed line inside a diff" |
| 16 | Counts | Computed frontend-side from the cached tree | The vault tree is already in memory, so this needs no new IPC and `delete_entry` stays a bare `Result<()>` |
| 17 | Keys while the *menu* is open | The menu registers the same `modal` layer; `isActive()` is true when either overlay is up | Otherwise `a` opens a draft *behind* the open menu and `d d` starts a delete behind it. `modal.cancel` dismisses the topmost; `modal.confirm` confirms the dialog when up, no-ops when only the menu is |
| 18 | Cursor after a delete | Nearest surviving neighbour — previous visible sibling, else parent directory, else `null` | Leaving it on a gone path makes `resolveDraftParent` silently fall back to the vault root on the next `a` |
| 19 | Routing | `/spec-breakdown` — 4 children, 3 waves | Clears `parallel-orchestration.md`'s 3–8 threshold with a real dependency graph |

## Explicitly Out of Scope

- **Rename.** Needs its own backend command, an in-place edit mode on an existing row, and
  wikilink-breakage thinking that create and delete do not. The obvious next slice.
- **Multi-select / bulk delete.** The sidebar has exactly one `cursorPath` and no selection model.
- **Drag-to-move entries.** No move command exists; same wikilink question as rename.
- **Retrofitting `CloseBufferDialog` / `SwitchVaultDialog` / `SettingsDialog` onto the `modal`
  layer.** They keep their hardcoded dismissal and keep leaking region chords under their scrims.
  Recorded in ADR 0014 as known and deferred.
- **A "don't ask again" preference.**
- **In-app undo or restore-from-trash.** Finder is the recovery path — that is the point of ADR 0012.

## Suggested decomposition

Input for `/spec-breakdown`, not a plan. `Layout.tsx` is touched by B, C and D; the dependency
graph already serializes them, so no two concurrent branches write it.

| Wave | Slice | Scope |
|------|-------|-------|
| 1 | **A** — Rust delete + trash | `trash` crate, `VaultError::NotFound`, `delete_entry_in` + command + root guard + unit tests, `vaultService.deleteEntry` |
| 1 | **B** — Modal layer + swallow | `DispatcherLayer.swallows`, `'modal'` first in `LAYER_PRECEDENCE`, `useModalKeymap`, dispatcher tests |
| 2 | **C** — Context menu + create wiring | `context-menu-store`, `SidebarContextMenu`, `onContextMenu` on rows and background, explicit-parent create. *Depends on B* |
| 3 | **D** — Delete end-to-end | `deleteVaultEntry` + delete summary, `confirm-delete`, `DeleteEntryDialog`, `closeBuffersUnder`, `sidebar.delete` = `d d` + `DEFAULT_KEYMAPS_TOML` re-sync, cursor repositioning, `doc/keybindings.md`. *Depends on A, B, C* |

## Glossary Changes

Written into `.agents/ubiquitous-language.md`; both affected sections carry a marker until the
epic lands.

- **Added:** *vault entry deletion*, *sidebar context menu*, *delete confirmation*, *delete
  summary*, *layer swallow*.
- **Amended:** *vault entry creation* (a third caller), *sidebar rail* (no context menu), *keymap
  layer* (`'modal'` is live and first in precedence), *keymap dispatcher* (corrected — "no
  fallthrough" applies only to a *match*; a non-matching active layer is skipped, which is the leak
  ADR 0014 fixes).
- **Invariant 25:** while a `modal` layer is active it absorbs every keydown, matched or not.
- **Invariant 26:** a vault deletion goes to the OS trash, closes every buffer at or under the
  deleted path, and discards their unsaved edits only behind an explicit confirmation.

## ADRs Raised

- `.agents/adr/0012-deletion-goes-to-the-os-trash.md`
- `.agents/adr/0013-context-menu-is-app-drawn.md` — note this cuts the opposite way from ADR 0008,
  which kept the native traffic lights precisely *for* native behavior; window chrome must behave
  like the platform's, whereas a menu of this app's own commands is content.
- `.agents/adr/0014-modal-layers-swallow-unmatched-keys.md`

## Residual Unknowns

None — the frontier emptied cleanly.

One consequence worth restating rather than discovering later: because trash makes the *file*
recoverable, the confirmation dialog is not primarily protecting the file. It is the only surface
on which "these dirty buffers will be discarded" can be disclosed, and those edits are genuinely
unrecoverable. If a later change makes deletion permanent, decision 7 stops being over-cautious and
starts being the only safeguard.
