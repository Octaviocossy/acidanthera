# Plan: Epic — Home surface and agent dock

> Status: **draft**
> Created: 2026-09-09
> Issue: #149
> Integration branch: epic/149-home-surface-and-agent-dock
> Spec: `.agents/specs/2026-09-09-home-surface-and-agent-dock.md`

## Goal

Turn the zero-buffer viewer into a **home surface** — brand mark over wordmark, a greeting,
three action rows and a docked agent composer — and make the two verbs it advertises real:
*daily note* is built, and *import notes* is reframed onto the existing `pickAndPersistVault()`.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #150 | `150-global-create-verbs-and-note-count` | Promote create verbs to the global layer and consolidate note counting | pending |
| 2 | #151 | `151-daily-note` | Daily note — configurable folder, find-or-create, `global.daily-note` | pending |
| 2 | #152 | `152-home-surface` | The home surface — three states, three rows, mark and greeting | pending |
| 2 | #153 | `153-sidebar-deltas` | Sidebar — daily note row, empty-tree line, theme toggle, settings rehomed | pending |
| 3 | #154 | `154-agent-dock` | The agent dock — a second composer that routes to the agent panel | pending |
| 3 | #155 | `155-navigation-history` | Navigation history — back/forward over buffer activations | pending |

## Dependency Edges

```
151 -> 150
152 -> 150
153 -> 150
154 -> 152
155 -> 153
```

## Why the graph is shaped this way

Logic and shared files agree here, which is what keeps the waves conflict-free:

| Shared file | Written by | Order forced |
|---|---|---|
| `src/lib/app-command.ts` | #150 (declare + `global.new-note`), #151 (`global.daily-note` dispatch) | 151 after 150 |
| `src/components/layout/Viewer.tsx` | #150 (`countNotes`), #152 (mount `HomeSurface`) | 152 after 150 |
| `src/components/layout/Sidebar.tsx` | #153 (deltas), #155 (chrome-strip controls) | 155 after 153 |
| `src/components/layout/HomeSurface.tsx` | #152 (create), #154 (mount the dock) | 154 after 152 |
| `src/components/ui/icon.tsx` | #150 only — six Lucide re-exports every later slice consumes | foundation |

No two children in the same wave touch the same file. Wave 2's three children are disjoint:
#151 is Rust + settings + `daily-note.ts`, #152 is `Viewer.tsx` + two new components, #153 is
`Sidebar.tsx` alone.

## ADRs

- `.agents/adr/0123-chrome-strip-admits-controls.md` — consumed by #155
- `.agents/adr/0124-one-transcript-composers-route-to-it.md` — consumed by #154

## Decisions taken against the recommendation

Both are settled and must not be re-litigated at the review gate:

- **#153 — the footer's ☀ displaces ⚙.** The recommendation was to keep the gear and refuse the
  sun. Step 3 of that issue (Settings to the brand row) is the non-optional consequence: without
  it Settings has no pointer affordance in the expanded sidebar, which is what ADR 0121 exists
  to prevent.
- **#155 — back/forward ships pointer-only.** The recommendation was `Ctrl-w o` / `Ctrl-w i`,
  mirroring vim's jumplist. This makes it the one navigation gesture unreachable from the
  keyboard, against `doc/v0-spec.md` §5.5; reversible by adding two `APP_COMMANDS` entries.

## Follow-up not in this epic

`doc/v0-spec.md` §5.0 and §5.3 and `.agents/skills/acidanthera-design/SKILL.md` describe the
current sidebar and empty state, and will drift the moment this lands — the same reconciliation
#147 did for epic #141.
