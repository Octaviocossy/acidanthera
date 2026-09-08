# Plan: Epic — Unified Sidebar and Chrome Strip

> Status: **draft**
> Created: 2026-09-08
> Issue: #141
> Integration branch: epic/141-unified-sidebar-and-chrome-strip

## Goal

Dissolve the 40px `Titlebar` into per-region chrome strips, float the editor and agent panel as
inset cards on the sidebar's own ground, and give the sidebar a primary nav, two-line note rows
and a footer identity block — so sidebar and chrome read as one surface.

Source spec: `.agents/specs/2026-09-08-unified-sidebar-and-chrome-strip.md` (settled, 43 decisions).
ADRs: `0035-chrome-strip-replaces-the-titlebar`, `0036-brand-mark-is-identity-not-signal`.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #142 | `142-vault-entry-modified-and-count-helpers` | feat: add vault entry modified time and note-count helpers | pending |
| 1 | #143 | `143-rename-chat-region-to-agent` | refactor: rename the chat region and panel to Agent | pending |
| 2 | #144 | `144-sidebar-chrome-strip` | feat: dissolve the titlebar into the sidebar chrome strip | pending |
| 3 | #145 | `145-inset-cards` | feat: render the editor and agent panel as inset cards | pending |
| 3 | #146 | `146-two-line-note-rows` | feat: two-line note rows with edited time and folder counts | pending |
| 4 | #147 | `147-reconcile-design-docs` | docs: reconcile v0-spec and the design skill with the shipped system | pending |

## Dependency Edges

```
144 -> 142
144 -> 143
145 -> 144
146 -> 142
146 -> 144
147 -> 144
147 -> 145
```

## Decomposition Rationale

- **Foundation-first.** #142 only *adds* — one Rust struct field and two pure TS helpers, no UI —
  so #144 and #146 consume it without touching the same files as each other.
- **#143 lands in wave 1 on purpose.** The chat toggle lives in `Titlebar.tsx`, which #144 deletes.
  Renaming first means #143 edits a file that still exists rather than producing a modify/delete
  conflict against its sibling.
- **#144 is one slice, not two.** `Titlebar`'s `✦` and `⚙` both land in the sidebar, so splitting
  "delete the bar" from "build their new homes" would leave the epic branch with neither control.
- **Shared-artifact edges.** `Sidebar.tsx` is rewritten by #144 and then read by #146;
  `Layout.tsx` is touched by both #144 and #145. Those are the edges, not just logical ordering.
- **Docs last.** #147 describes the finished shell, so it follows #144 and #145 rather than racing
  them. It also carries drift that predates this epic (`AiFab`, `Badge`, "do not add an icon
  dependency").

## Validation Notes

Three residual unknowns from the spec are validation steps inside their slices, not open questions:

1. **`TRAFFIC_LIGHT_CLEARANCE`** (#144) is a real screenshot measurement, not a guess.
   `.agents/specs/2026-08-15-center-the-traffic-lights.md` assumed 20 for the traffic lights' `x`
   and measured 9 / 15.5.
2. **Two-line row density** (#146) costs roughly a third of the visible rows; only the running app
   can settle whether the trade holds.
3. **Window dragging across two strips** (#144) is verifiable only in the app, never in a unit test.
