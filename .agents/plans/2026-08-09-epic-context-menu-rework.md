# Plan: Epic — Sidebar context menu rework, rename, duplicate & Lucide icons

> Status: **draft**
> Created: 2026-08-09
> Updated: 2026-08-09
> Issue: #124
> Integration branch: epic/124-context-menu-rework
> Spec: `.agents/specs/2026-08-09-sidebar-context-menu-rework.md`

## Goal

Rebuild the sidebar context menu to the reworked mockup — seven rows in four grouped sections,
each with an icon and a live shortcut hint — and build the two features it introduces: Rename,
which drags the long-deferred wikilink question with it, and Duplicate.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #125 | `125-lucide-icon-primitive` | feat: adopt Lucide icons behind an Icon primitive | pending |
| 1 | #126 | `126-vault-rename-duplicate-rust` | feat: rename and duplicate vault entries (Rust) | pending |
| 2 | #127 | `127-wikilink-scan-rewrite` | feat: scan and rewrite wikilinks (Rust) | pending |
| 2 | #128 | `128-context-menu-ui` | feat: rework the sidebar context menu and wire duplicate | pending |
| 3 | #129 | `129-rename-end-to-end` | feat: rename end-to-end with wikilink rewriting | pending |

## Dependency Edges

```
127 -> 126
128 -> 125
128 -> 126
129 -> 127
129 -> 128
```

## Decomposition note

The spec's suggested table listed six slices with Duplicate and Rename both in wave 3, claiming
the graph serialized every shared file. It does not: that pair both writes
`SidebarContextMenu.tsx`, `src/lib/app-command.ts`, `src/lib/keymap/defaults.ts` and
`DEFAULT_KEYMAPS_TOML` in `src-tauri/src/config.rs`. Duplicate is folded into #128, which already
owns those four files, and #128 also registers Rename's command id and chord so #129 never touches
them.

Shared-file serialization:

| File | Written by | Serialized because |
|------|-----------|--------------------|
| `src-tauri/src/vault.rs` | #126, #127 | 127 depends on 126 |
| `src/services/vault.service.ts` | #126, #127 | same edge |
| `src/components/vault/glyphs.tsx` | #125 only | — |
| `src/components/vault/SidebarContextMenu.tsx` | #128, #129 | 129 depends on 128 |
| `app-command.ts`, `defaults.ts`, `config.rs`, `doc/keybindings.md` | #128 only | both chords land there |
| `src/stores/editor-store.ts`, `src/stores/sidebar-store.ts` | #129 only | — |

## ADRs

- `.agents/adr/0016-wikilink-rewriting-scans-not-indexes.md`
- `.agents/adr/0017-icons-come-from-lucide.md`
- `.agents/adr/0018-red-marks-the-destructive-path.md` — narrows ADR 0015

## Glossary marker

`.agents/ubiquitous-language.md` carries a settled-ahead-of-implementation marker in both
**Vault and note navigation** and **Cross-cutting presentation vocabulary**. Remove both when this
epic lands.
