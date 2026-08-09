# The sidebar is never hidden — it collapses to a rail

`closeSidebar` used to unmount `Sidebar` entirely, which made its visibility control a one-way door:
a button inside a component that deletes itself can only ever hide. The sidebar now always occupies
a 40px rail carrying the orbit mark, its own expand toggle, find / new note / new folder, and one
icon per vault root entry. The toggle can therefore live inside the sidebar in both states, and the
titlebar's re-show control is deleted.

## Consequences

**Always visible is not the same as always reachable.** The sidebar is a `FocusRegion`, and a
collapsed rail has no visible cursor, so `reachableRegions` keys on *expansion* rather than
visibility — `Ctrl-w l`/`h` skip a collapsed rail exactly as they skipped a hidden sidebar. A reader
who finds a rendered region that the focus state machine refuses to enter is looking at this, not a
bug. `collapseSidebar` still moves `activeRegion` off `'sidebar'` for the same reason.

**The rail is a launcher, not a preview.** Clicking a root *file* opens it and leaves the rail
collapsed; clicking a root *directory* expands the sidebar, because a directory has nothing to show
at 40px. The same asymmetry governs new note / new folder, which expand first so `EntryDraftRow` has
a row to render into. Anyone "fixing" the inconsistency by making every click expand would remove
the only reason the rail is useful.

**This supersedes ADR 0009's premise** that the titlebar is the app's only always-visible chrome
host. It is now one of two, and the titlebar keeps only the window title and settings. The rest of
0009 stands: there is still no status bar, and state still renders on the surface that owns it.

The collapsed state is deliberately **not persisted** — the sidebar reopens expanded on every
launch. Persisting it means a new `settings.toml` key with its own default, per-field diagnostic and
comment-preserving write, which is a larger decision than this one.

> Raised by: `/grill`, 2026-08-08. See `.agents/specs/2026-08-08-collapsible-sidebar-rail.md`
> (decisions 1, 2, 3, 10, 18).
