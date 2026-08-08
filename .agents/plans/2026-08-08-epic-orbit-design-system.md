# Plan: Epic — Orbit design system — adoption & re-skin

> Status: **draft**
> Created: 2026-08-08
> Updated: 2026-08-08
> Issue: #102
> Integration branch: `epic/102-orbit-design-system`

## Goal

Adopt the Orbit design system (Claude Design project `d333dc32-6b35-4f89-9982-66bbc1014fcb`) — five-step
surface ladder, four-step text ladder, eight-step semantic radius ladder, one AI-only ember accent,
JetBrains Mono content voice, app-drawn titlebar, Unicode glyph vocabulary — and re-skin every surface
orbit-111 already ships so the app matches the approved mockups (options 1a–1g).

Source spec: `.agents/specs/2026-08-08-orbit-design-system.md` (settled — 4 rounds, 18 decisions).
ADRs: `0006-orbit-token-vocabulary`, `0007-accent-is-ai-only`, `0008-custom-titlebar-macos-only`.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #103 | `103-orbit-token-type-foundation` | Orbit token & type foundation | pending |
| 2 | #104 | `104-design-primitives-iconography` | Design primitives & iconography | pending |
| 2 | #105 | `105-app-drawn-titlebar` | App-drawn titlebar | pending |
| 3 | #106 | `106-reskin-vault-sidebar` | Re-skin the vault sidebar | pending |
| 3 | #107 | `107-reskin-editor-tabs-status-bar` | Re-skin the editor, tabs & status bar | pending |
| 3 | #108 | `108-reskin-chat-ai-surface` | Re-skin the chat & AI surface | pending |
| 3 | #109 | `109-reskin-overlays` | Re-skin the overlays | pending |
| 4 | #110 | `110-retire-factory-vocabulary` | Retire the Factory vocabulary & document the system | pending |

## Dependency Edges

```
104 -> 103
105 -> 103
106 -> 103
106 -> 104
107 -> 103
107 -> 104
108 -> 103
108 -> 104
109 -> 103
109 -> 104
110 -> 105
110 -> 106
110 -> 107
110 -> 108
110 -> 109
```

## Slice ownership (why parallel children do not collide)

Wave 3 runs four children concurrently. File ownership is disjoint by design:

| Slice | Owns |
|-------|------|
| #103 | `src/styles/**`, `package.json`, `src-tauri/src/settings.rs`, three test fixtures |
| #104 | `src/components/ui/**`, `src/components/vault/glyphs.tsx` |
| #105 | `src/components/layout/Titlebar.tsx`, `Layout.tsx`, `tauri.conf.json`, `capabilities/default.json` |
| #106 | `src/components/layout/Sidebar.tsx`, `src/components/vault/FileTreeItem.tsx`, `EntryDraftRow.tsx` |
| #107 | `src/lib/editor/{highlight,theme}.ts`, `src/components/editor/**`, `layout/{Viewer,StatusBar}.tsx` |
| #108 | `src/components/ai/**`, `src/components/layout/ChatPanel.tsx` |
| #109 | `src/components/layout/{FileFinder,SettingsDialog,CloseBufferDialog,SwitchVaultDialog,CommandBar,ToastHost}.tsx` |
| #110 | `src/styles/**` (deletions), `doc/v0-spec.md`, `.agents/skills/orbit-design/**`, `AGENTS.md`, `README.md`, glossary |

Only #105 writes `Layout.tsx`; only #104 writes `glyphs.tsx` (#107 adds one `CloseGlyph` — the single
cross-slice touch, and #104 has already merged by then); only #103 and later #110 write `src/styles/`.

## Architecture Decisions

- **Foundation-first.** #103 changes token *values and names* and touches no component, so every wave-2
  and wave-3 sibling only adds or edits files it exclusively owns. Factory names survive as aliases in
  `@theme` so untouched components keep compiling mid-migration (ADR 0006).
- **The cleanup slice is a dependency of every wave-3 child**, not an appendix. That ordering is what
  guarantees it runs only after the last consumer has migrated off the aliases.
- **Accent discipline is enforced per slice.** Each child issue enumerates its sanctioned accent uses;
  a slice with none says so. Invariant 21 is the acceptance bar.
- **Two upstream token defects are resolved in #103**, both documented in that issue: the design's
  `--text-body` is defined as both a color and a font size, and its `--accent` collides with the
  shadcn semantic layer's hover-surface `--accent` already in `index.css`.

## Validation Criteria

- [ ] Every child issue is closed and merged into `epic/102-orbit-design-system`
- [ ] `pnpm lint && pnpm build && pnpm test && pnpm test:rust` pass on the epic branch
- [ ] `grep -rn -- "--fab-accent\|--accent-signal\|--accent-metric" src/` returns nothing after #110
- [ ] Both themes render with no element falling back to `currentColor`
- [ ] One `epic → main` PR opened with `Closes #102`

## Open Questions

None.
