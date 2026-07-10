# Plan: Sidebar new-file / new-folder affordance

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #40

## Goal

Give the sidebar a way to create a note or a folder — the UI slice that consumes the guarded
`create_note` / `create_directory` commands landed in #36 — so a vault can be filled from inside
the app rather than from a terminal.

## Context

- #36 built the backend half: `vaultService.createNote` / `vaultService.createDirectory`, both
  root-guarded, both atomic (a collision fails with `AlreadyExists` rather than clobbering), both
  returning the created path. `build_tree` was changed in the same slice to keep empty directories
  so a freshly created folder is immediately visible.
- The sidebar today only *reads*: `Sidebar` refetches the tree on `vault-changed`, `FileTreeItem`
  renders a row, `useSidebarKeymap` moves the cursor with `j`/`k`/`l`/`h`/`Enter`.
- Nothing calls the two creation commands. This slice wires them to a mouse affordance (two header
  buttons) and a keyboard affordance (`a` / `A`), naming the entry through an inline draft row.
- Constraint (from the glossary): `create_note`/`create_directory` never materialize a missing
  parent chain, so the draft's parent must always be an existing directory, and the typed name must
  be a *name*, not a path.
- Constraint: `create_*` trips the `notify` watcher, which drives `Sidebar`'s existing refetch — no
  manual tree invalidation anywhere in this slice.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/components/vault/glyphs.tsx` | Shared sidebar SVG glyphs (chevron/file, extracted from `FileTreeItem`) + the two new-entry glyphs |
| MODIFY | `src/components/vault/FileTreeItem.tsx` | Import the glyphs instead of declaring them privately |
| CREATE | `src/components/vault/EntryDraftRow.tsx` | The inline "name your new entry" tree row |
| MODIFY | `src/stores/sidebar-store.ts` | `EntryDraft` state + `beginDraft` / `cancelDraft` |
| CREATE | `src/lib/vault/create-entry.ts` | `resolveDraftParent`, `draftPlacement`, `createVaultEntry` |
| MODIFY | `src/hooks/use-sidebar-keymap.ts` | `a` (new note) / `A` (new folder) chords |
| MODIFY | `src/components/layout/Sidebar.tsx` | Header buttons + draft-row insertion |
| MODIFY | `.agents/ubiquitous-language.md` | New domain terms, relationships, changelog |

## Step-by-Step Implementation

1. **Extract the row glyphs.** Move `ChevronGlyph`/`FileGlyph` out of `FileTreeItem.tsx` into
   `src/components/vault/glyphs.tsx` and add `NewNoteGlyph`/`NewFolderGlyph` (Lucide-shaped
   `file-plus` / `folder-plus`, `currentColor`, hairline stroke). Both the draft row and the header
   buttons need glyphs; duplicating the SVGs would be worse than one shared module.

2. **Model the draft.** In `src/stores/sidebar-store.ts` add
   `export type EntryDraftKind = 'note' | 'directory'` and
   `export interface EntryDraft { kind: EntryDraftKind; parentPath: string }`, plus
   `draft: EntryDraft | null`, `beginDraft(kind, parentPath)`, `cancelDraft()`.
   `beginDraft` also adds `parentPath` to `expanded` so the draft row is on screen when the target
   directory was folded.

3. **Pure placement helpers + the create action** (`src/lib/vault/create-entry.ts`):
   - `resolveDraftParent(rows: FlatVaultRow[], cursorPath: string | null, vaultRoot: string | null): string | null`
     — the cursor row when it is a directory, otherwise its nearest ancestor row, otherwise the
     vault root. `null` only when no vault is open.
   - `draftPlacement(rows: FlatVaultRow[], draft: EntryDraft): { index: number; depth: number }`
     — the draft renders as the parent's first child; the vault root has no row, so it lands at the
     top of the tree.
   - `createVaultEntry(draft, rawName)` — trims, rejects an empty name (cancel) and a name carrying
     a path separator (error toast), calls `createNote`/`createDirectory`, then cancels the draft,
     moves the cursor onto the created path and, for a note, opens it. A rejected create leaves the
     draft up so the name can be corrected.

4. **Draft row** (`src/components/vault/EntryDraftRow.tsx`): `FileTreeItem`'s geometry
   (`h-6`, `depth * 12 + 8` indent, glyph, label slot) with an auto-focused `<input>` in the label
   slot. `Enter` commits, `Escape` and blur cancel.

5. **Keyboard** (`use-sidebar-keymap.ts`): handle `a`/`A` *before* the `rows.length === 0` early
   return — an empty vault is exactly when you most need to create the first note.

6. **Sidebar** (`Sidebar.tsx`): header becomes a flex row with two quiet icon buttons (shown only
   once a vault is open); the draft row is spliced into the rendered rows at `draftPlacement`.

7. **Glossary**: add `EntryDraft`, `EntryDraftRow`, `createVaultEntry`; record the relationships and
   bump the changelog + "Last updated".

## Architecture Decisions

- **Inline draft row, not a modal.** Naming happens where the entry will appear, so the target
  directory is legible without a "creating in …" caption. It also keeps the one-overlay rule
  (`SettingsDialog`) intact.
- **The draft lives in `useSidebarStore`, not in `Sidebar`'s local state**, because the keymap
  starts it and the component renders it — the same split as `cursorPath`.
- **`createVaultEntry` is a `lib/vault/` action, not a store method**, mirroring `openVaultFile`:
  it composes `vaultService` + two stores and performs I/O, which is exactly what the existing
  helpers in that folder do and what the stores deliberately don't.
- **Names may not contain a separator.** The backend refuses a missing parent chain, so a separator
  could only ever mean "into an existing subfolder" — ambiguous next to the draft row's own visible
  parent. Rejecting it keeps "the row's indent is where the entry lands" true.
- **A failed create keeps the draft open.** The overwhelmingly common failure is `AlreadyExists`;
  discarding the typed name would be hostile.
- **No manual tree refresh.** `create_*` trips the watcher → `vault-changed` → the existing refetch.

## Validation Criteria

Automated gates were run; the manual smoke tests were **not** — this slice was implemented in a
headless worktree with no GUI session to drive the Tauri window.

- [x] `pnpm check` (biome lint + format) passes
- [x] `pnpm build` (tsc + vite) passes
- [x] `cargo test` (the #36 backend tests) still passes — 16 passed
- [ ] Manual: `a` on an empty vault creates a note at the root and opens it in the editor
- [ ] Manual: `a` with the cursor on a folder creates the note inside it (folder auto-expands)
- [ ] Manual: `a` with the cursor on a file creates the note as its sibling
- [ ] Manual: `A` creates a folder; it appears immediately even though it is empty
- [ ] Manual: naming a new note the same as an existing one shows an error toast and keeps the draft
- [ ] Manual: `Escape` / clicking away cancels the draft

## Open Questions

None.
