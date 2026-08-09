# Plan: Epic — Sidebar context menu (create & delete)

> Status: **draft**
> Created: 2026-08-09
> Updated: 2026-08-09
> Issue: #115
> Integration branch: epic/115-sidebar-context-menu
> Spec: `.agents/specs/2026-08-09-sidebar-context-menu.md`

## Goal

Give the sidebar a right-click menu offering New note, New folder and Delete, so vault entries can
be created against the row the user pointed at — and, for the first time, removed from inside the
app at all.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #116 | `116-vault-entry-deletion-trash-command` | feat: vault entry deletion — trash-backed Rust command | pending |
| 1 | #117 | `117-modal-keymap-layer-swallow` | feat: modal keymap layer with swallow semantics | pending |
| 2 | #119 | `119-sidebar-context-menu-overlay` | feat: sidebar context menu overlay + create actions | pending |
| 3 | #121 | `121-delete-entry-end-to-end` | feat: delete end-to-end — confirmation, buffer close, `d d` | pending |

## Dependency Edges

```
119 -> 117
121 -> 116
121 -> 117
121 -> 119
```

## ADRs

- `.agents/adr/0012-deletion-goes-to-the-os-trash.md`
- `.agents/adr/0013-context-menu-is-app-drawn.md`
- `.agents/adr/0014-modal-layers-swallow-unmatched-keys.md`

## Notes for execution

- **Shared files are serialized by the graph.** `src/components/layout/Layout.tsx` is touched by
  #117, #119 and #121 — each mounts exactly one thing — and `SidebarContextMenu.tsx` is created by
  #119 and extended by #121. No two concurrent branches write either file, so no worktree
  isolation beyond the runner's default is needed.
- **#116 and #117 are genuinely independent** — one is Rust-only plus a service wrapper, the other
  is the keymap dispatcher. They share no file.
- **Nothing inert ships mid-epic.** #119 deliberately ships the menu with only the two create
  items; the separator and Delete arrive in #121 together with their backend, confirmation and
  chord.
- **Pre-flight:** the working tree carried unrelated uncommitted changes when this epic was
  created (`AiFab.tsx` deleted, chat toggle moved into `Titlebar.tsx`, `Layout.tsx` modified),
  matching the untracked spec `.agents/specs/2026-08-09-relocate-the-chat-toggle.md`. Because
  `Layout.tsx` overlaps this epic, land or stash that work before running `/execute-epic` — the
  runner cuts child worktrees from the epic branch and will not pick up uncommitted state.
