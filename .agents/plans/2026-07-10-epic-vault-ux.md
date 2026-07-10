# Plan: Epic — Vault UX (wrapping, entry creation, hideable sidebar, chat chrome, agent context)

> Status: **draft**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #35

## Goal

Six quality-of-life slices over the v0 shell: the editor wraps long lines instead of scrolling,
the sidebar can create notes and folders and can be hidden entirely, the AI chat button moves to
the top-right while the chat header sheds its engine selector, and every vault the app adopts
gets an `AGENTS.md` / `CLAUDE.md` agent-context pair at its root.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #36 | `36-vault-create-backend` | feat: vault entry creation backend + show empty directories | pending |
| 1 | #37 | `37-editor-line-wrapping` | feat: wrap editor lines instead of scrolling horizontally | pending |
| 1 | #38 | `38-hideable-sidebar` | feat: hideable sidebar | pending |
| 1 | #39 | `39-chat-chrome` | feat: move the AI chat button to the top-right, strip the chat header chrome | pending |
| 2 | #40 | `40-sidebar-create-entry` | feat: sidebar new-file / new-folder affordance | pending |
| 2 | #41 | `41-vault-agent-context` | feat: scaffold AGENTS.md / CLAUDE.md agent context in the vault root | pending |

## Dependency Edges

```
40 -> 36
41 -> 36
```

`#40` depends on `#36` **behaviorally** — it calls `vaultService.createNote` / `createFolder`,
and without `#36`'s `build_tree` change a newly created folder never reaches the frontend.

`#41` depends on `#36` only as a **shared artifact** — both edit `src-tauri/src/vault.rs` and
`src-tauri/src/lib.rs`. There is no behavioral coupling; the dependency exists purely to keep the
two Rust branches from conflicting.

## File Ownership (wave 1 is disjoint by construction)

| Issue | Files it owns |
|-------|---------------|
| #36 | `src-tauri/src/vault.rs`, `src-tauri/src/lib.rs`, `src/services/vault.service.ts` |
| #37 | `src/components/layout/Viewer.tsx` |
| #38 | `src/stores/app-store.ts`, `src/components/layout/Layout.tsx`, `src/hooks/use-global-keymap.ts`, `src/lib/editor/region-exit.ts`, `src/components/layout/StatusBar.tsx` |
| #39 | `src/components/ai/AiFab.tsx`, `src/components/layout/ChatPanel.tsx` |
| #40 | `src/lib/vault/create-entry.ts` (new), `src/components/vault/NewEntryInput.tsx` (new), `src/lib/vault/flatten-tree.ts`, `src/stores/sidebar-store.ts`, `src/components/layout/Sidebar.tsx`, `src/hooks/use-sidebar-keymap.ts` |
| #41 | `src-tauri/templates/AGENTS.md` (new), `src-tauri/src/agent_context.rs` (new), `src-tauri/src/vault.rs`, `src-tauri/src/lib.rs` |

**Every** child also edits `.agents/ubiquitous-language.md` (entity rows + changelog row), per
`.agents/rules/domain-glossary.md`. That file will conflict on the second and subsequent merges
of each wave. The conflicts are confined to the entity table and the changelog table; resolve by
keeping both sides' rows.

## Decisions Taken at Breakdown Time

Four points in the source spec were ambiguous and were resolved with the author before the child
issues were written. They are recorded verbatim on epic #35.

1. **Line wrapping is unconditional**, not scoped to `chatOpen`. `EditorView.lineWrapping` goes
   into `Viewer`'s module-level base extension array. The conditional form would need a CM6
   `Compartment`, an `EditorView` ref threaded out of `@uiw/react-codemirror`, and a reconfigure
   on every chat toggle — real complexity for a behavior nobody wants back.
2. **"Remove the AI btns from the AI chat" means both**: the engine badges leave the `ChatPanel`
   header, **and** `AiFab` does not render while the chat is open. Consequence handled in #39:
   the chat header gains a close control in the slot the badges vacate, since the button was the
   only mouse path back.
3. **The agent context is two files.** `AGENTS.md` holds the full persona (Codex reads it);
   `CLAUDE.md` is the single line `@AGENTS.md` (Claude Code reads it and follows the import).
   The same pattern this repo uses at its own root. One source of truth, no drift.
4. **The persona template ships with its `<placeholder>` blanks verbatim.** A scaffold the user
   fills in by hand, not a pre-filled default.

## Architecture Decisions

- **Foundation-first.** #36 is the only wave-1 child touching the Rust vault layer, so the two
  wave-2 children can be cut from a `main` that already has it. This is the shared-artifact
  heuristic from `.agents/rules/parallel-orchestration.md`, applied to `vault.rs` / `lib.rs`
  rather than to a `*.pbxproj`.
- **Empty directories become visible (#36).** `build_tree` currently drops any directory without
  a transitive `.md` descendant. Keeping that filter would make #40's "New folder" button create
  an invisible directory. This changes a rule the glossary states explicitly, so the glossary
  moves with it.
- **`AlreadyExists` as a distinct `VaultError` variant (#36).** It lets #40 keep the inline name
  input open on a duplicate name, and lets #41's scaffold skip files it has already written.
- **The sidebar mirrors the chat's visibility shape (#38)**, rather than generalizing both into a
  `visibleRegions: Set<FocusRegion>`. The chat is an *invocable* region with a process lifecycle;
  the sidebar is a *dismissable* presentational one. They share a filter, not a lifecycle.
- **Accent discipline survives #39.** `--fab-accent` still appears in exactly one component; only
  its trigger moves, from "chat is open" (a state that no longer renders the button) to
  hover/focus-visible.
- **The persona reaches the engine through the process `cwd` (#41)**, not through the
  `AgentBackend` interface. `useChatStore.sendMessage` already passes `vaultRoot` as `cwd`, and
  each CLI discovers its own context file there. No adapter reads these files, so no adapter
  changes.

## Validation Criteria

- [ ] All six child issues merged into `main` via their own PRs (`Closes #N`).
- [ ] `pnpm check && pnpm build` passes on `main` after each wave's merges.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` and
      `cargo test --manifest-path src-tauri/Cargo.toml` pass after #36 and #41 land. The runner's
      `ACCEPTANCE_CMD` is frontend-only and does **not** cover these.
- [ ] `.agents/ubiquitous-language.md` reconciled after each merge — no lost entity rows, one
      changelog row per child, **Last updated** current.
- [ ] Manual smoke on `main`: launch the app against a fresh `~/Documents/orbit-brain`; the vault
      is created with `AGENTS.md` + `CLAUDE.md`; `a` creates a note that opens in a wrapping
      editor; `A` creates a folder that appears in the tree; `Ctrl-w b` hides the sidebar; the AI
      button is top-right and disappears when the chat opens.

## Open Questions

- **Should `sidebarVisible` persist across restarts?** #38 builds it as session state, matching
  `chatOpen`. Persisting it would add a fifth `Settings` field and pull the slice into
  `src-tauri/src/settings.rs`, `src/services/settings.service.ts`, and `useSettingsBootstrap`.
  Raised in #38's Open Questions; currently a follow-up, not in scope.
- **Should the chat be closeable only by keyboard?** #39 adds a `✕` to the chat header because
  hiding `AiFab` while the chat is open removes the mouse path back. If `Ctrl-w c` alone is
  preferred, drop the close button and leave the header's right slot empty.

## Execution

Run `/execute-epic` to execute wave 1 (#36, #37, #38, #39) in parallel. It opens a PR per child,
ticks the epic task-list, then stops so the wave's PRs can be merged before wave 2 (#40, #41).
Re-running is idempotent: it skips merged children and recomputes the frontier.
