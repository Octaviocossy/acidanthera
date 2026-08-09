# Config files are reachable only from the file finder

`settings.toml` and `keymaps.toml` are no longer surfaced as sidebar rows. ADR 0004 put them in two
vault-scoped surfaces at once — a pinned Config section in the sidebar *and* the fuzzy finder — but
only the finder paid for itself: the sidebar section cost a second row source
(`SidebarRow`/`flattenSidebarRows`), a synthetic `CONFIG_SECTION_PATH` cursor key, and a vault-only
guard on `a`/`A` in two places, to save a keystroke on two files that are edited rarely and are
already ranked by name in the finder.

## Consequences

The sidebar goes back to exactly one row source. `flattenSidebarRows` and `sidebar-rows.ts` are
deleted, `Sidebar` and `use-sidebar-keymap` read `flattenVisibleTree` again, and the non-vault guard
that stopped a draft being created under a config row goes with them — there is no longer such a
row to guard against.

Everything else about config buffers is untouched and still load-bearing: `CONFIG_ENTRIES`,
`collectConfigCandidates`, the finder's `config` chip, `openConfigFile`, `EditorBufferSource`, save
routing, and TOML highlighting. The files remain fully editable in orbit's own editor; only the
entry point narrowed.

ADR 0004's core decision — config lives outside the vault but is surfaced inside vault-scoped UI —
still holds, because the finder is vault-scoped UI. Only the first of its two documented
consequences is superseded.

> Raised by: `/grill`, 2026-08-08. See `.agents/specs/2026-08-08-collapsible-sidebar-rail.md`
> (decision 5).
