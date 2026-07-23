# Plan: Clean Up the Ubiquitous Language Glossary

> Status: **completed**
> Created: 2026-07-22
> Updated: 2026-07-22

## Goal

Restructure `.agents/ubiquitous-language.md` into a concise, current technical-domain glossary that clearly defines canonical terminology and invariants without duplicating release history or brittle implementation details. Update the governing rule to prevent the glossary from returning to its current append-only state.

## Context

- The glossary's lines 6-132 contain a malformed `Last updated` block with unclosed parentheticals and eleven historical summaries duplicating the Changelog.
- The single `Core entities` table mixes domain concepts, stores, UI components, service wrappers, CSS tokens, design rationale, import graphs, and release notes.
- Several entries no longer match source code, including references to removed editor APIs such as `saveIntent`, `filePath`, and `markSaved`.
- Some relationship claims are demonstrably false, including "sole consumer" statements for `useSidebarStore` and `agentProcessService`.
- The glossary contradicts itself about whether `useChatStore` imports the chat format and prompt modules.
- The current rule contains scaffold-only FK/auth guidance and does not define what belongs in the glossary.
- The selected approach is a structured technical glossary: preserve terms that guide naming, contracts, and invariants; remove component inventories, release narratives, and caller graphs.
- The historical Changelog will be preserved and explicitly marked as non-canonical for current behavior.
- This is documentation-only work. No behavior under `src/` or `src-tauri/src/` should change.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `.agents/rules/domain-glossary.md` | Define project-specific glossary inclusion, exclusion, and maintenance rules |
| MODIFY | `.agents/ubiquitous-language.md` | Replace the overgrown document with a structured, current technical-domain glossary |

## Step-by-Step Implementation

> **Step 1 - Make the domain-glossary rule project-specific**
>
> - **File:** `.agents/rules/domain-glossary.md`
> - **Action:** MODIFY
> - **Details:** Preserve the canonical domain paths and cross-agent applicability sections. Remove the setup placeholder and irrelevant FK, cascade, endpoint, and authentication checks.
> - Add explicit inclusion criteria for canonical concepts, states, processes, data contracts, naming distinctions, and cross-slice invariants.
> - Add exclusion criteria for component inventories, styling retrospectives, service wrappers with no naming ambiguity, exact caller/import graphs, and release chronology.
> - State that glossary definitions describe current behavior; historical or superseded behavior belongs only in the Changelog.
> - Require `Last updated` to contain only an ISO date, without an accumulating summary.
> - Retain the requirement to update the date and Changelog when canonical vocabulary or an invariant changes.
> - **Why:** The rule must prevent the structural problems being removed from the glossary.

> **Step 2 - Normalize glossary metadata and maintenance guidance**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Replace the entire lines 6-132 block with compact metadata:
>
> ```markdown
> > Single source of truth for current domain and technical terminology.
> > Read this before changing canonical types, states, processes, or data contracts.
> >
> > **Last updated:** 2026-07-22
> > **Canonical code:** `src/` (TypeScript), `src-tauri/src/` (Rust)
> ```
>
> - Remove every `Prior (...)` summary because the Changelog already records that history.
> - Rewrite "How to maintain this document" to match the revised rule: describe current truth, add only terminology with naming or contract value, keep definitions concise, and place history only in the Changelog.
> - **Why:** Metadata should communicate freshness rather than become a second release log.

> **Step 3 - Rebuild the vocabulary as domain-oriented sections**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Replace the single `Core entities` table with repeated tables using the existing columns `Term`, `Canonical type`, `Aliases to avoid`, and `Notes`.
>
> | Section | Terms to retain or consolidate |
> |---------|--------------------------------|
> | Application shell and commands | Focus region, global mode, region visibility, app store, app command / `find-file` |
> | Vault and note navigation | Vault, vault entry, vault-change event, vault entry creation, vault agent context, sidebar store, entry draft, vault file candidate, file finder, open vault file |
> | Editor session | Editor store, editor buffer, empty editor state, editor Vim mode, editor save request, save lifecycle, tabs and close lifecycle, system clipboard yank, wikilink |
> | Agents and models | Agent event, agent source, agent backend, backend registry, agent model and model catalog, agent process boundary |
> | Conversations and history | Conversation/thread, chat store, chat item, chat file, chat-file serialization, conversational message, message-count truncation, resume prompt, chat persistence store, chat record, chat history store |
> | Settings and feedback | Settings, settings store/bootstrap, default vault, toast feedback |
> | Cross-cutting presentation vocabulary | Factory signal and metric accents only |
>
> - Introduce `App command` using `AppCommandId` and `executeAppCommand` from `src/lib/app-command.ts`; record `find-file` as the shared command used by both keymap layers.
> - Introduce `Vault` as the user-selected root directory represented by frontend `vaultRoot` and backend `VaultState`.
> - Introduce `Conversation/thread` as the durable logical conversation represented in memory by `useChatStore` and on disk by `ChatFile`.
> - Consolidate closely related implementation rows rather than preserving a row for every helper, hook, or component.
> - Keep notes focused on identity, state shape, naming distinctions, and behavioral contracts. Remove issue-by-issue evolution, styling retrospectives, exact command flags, and "future slice" language.
> - **Why:** Domain grouping makes terminology discoverable and prevents implementation inventory from obscuring canonical concepts.

> **Step 4 - Remove entries without independent terminology value**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Remove standalone rows for `AiFab`, `CloseBufferDialog`, `clipboardService`, `vaultService`, `FileTreeItem`, `EntryDraftRow`, `createVaultEntry`, sidebar keymap, concrete Claude/Codex backends, `agentProcessService`, `AgentProcessState`, `ChatMessage`, `ThinkingIndicator`, `ToolChip`, `ChatInput`, chat-history keymap/list, `chatsService`, `VaultState::root`, `settingsService`, backend logger, `ToastHost`, `SettingsDialog`, `pickAndPersistVault`, theme application, editor-font token, and Factory raw palette tokens.
> - Retain relevant canonical names inside the notes of their parent concepts where needed.
> - Consolidate global keymap and `regionExit` under app-command dispatch and focus invariants.
> - Consolidate `useSaveLoop` under the editor save lifecycle.
> - Keep a concise Factory accent entry because the signal/metric distinction is a cross-cutting usage invariant. Describe `--fab-accent` accurately as a legacy alias still used by `Badge`; do not retain the obsolete "one release until #58" claim.
> - **Why:** These entries primarily describe implementation placement or release history rather than language shared across the application.

> **Step 5 - Correct current-state definitions against source**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Reconcile definitions with the following source anchors:
>
> | Source | Required correction |
> |--------|---------------------|
> | `src/lib/app-command.ts`, `src/hooks/use-global-keymap.ts`, `src/lib/editor/region-exit.ts` | Include `Ctrl-w f` and shared `find-file` command dispatch |
> | `src/stores/editor-store.ts` | Use `EditorBuffer[]`, nullable `activeBufferId`, and FIFO `EditorSaveRequest[]`; remove `useEditorStore.filePath` |
> | `src/hooks/use-save-loop.ts` | Describe sequential request draining via `completeSaveRequest`/`failSaveRequest`; remove `saveIntent` and `markSaved` |
> | `src/lib/vault/open-file.ts` | Record path deduplication, activation without rereading, and viewer focus |
> | `src/lib/editor/wikilink.ts` | Describe the actual dim-text and hover behavior rather than default underlining |
> | `src-tauri/src/vault.rs` | State that canonical in-root paths are accepted; do not claim paths must originate from the vault tree |
> | `src/stores/chat-store.ts` | Record runtime use of chat-file serialization and resume-prompt building |
> | `src/stores/chat-store.ts` | State that resume prompts apply after disk load and after model changes with existing history |
> | `src/stores/chat-history-store.ts`, `src/components/ai/ChatHistoryList.tsx` | Describe history browsing as implemented, not future work |
> | `src/lib/agent/backends/*.backend.ts` | Remove the false claim that only Claude Code consumes `agentProcessService` |
> | `src/styles/tokens/colors.css`, `src/components/ui/badge.tsx` | Describe the current legacy accent alias without obsolete migration timing |
>
> - Remove or rewrite all brittle "sole consumer," "only caller," and exact import-edge claims unless they express an intentionally enforced architectural invariant.
> - **Why:** A canonical glossary must describe the code that exists now.

> **Step 6 - Replace caller graphs with durable invariants**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Rename `Relationships` to `Invariants and relationships` and reduce it to durable contracts:
>
> 1. Focus regions remain reachable only while their corresponding region is visible.
> 2. Global mode and editor Vim mode remain separate state machines.
> 3. Both keyboard layers dispatch shared app commands rather than duplicating command behavior.
> 4. Vault filesystem operations remain contained within the canonical vault root and reject symlink escapes.
> 5. Vault creation refreshes through the watcher; callers do not mutate the cached tree directly.
> 6. Opening an already-buffered note activates it without replacing dirty in-memory content.
> 7. Save requests are immutable snapshots processed in FIFO order, and completion applies only to the captured revision.
> 8. Dirty buffer close cannot discard changes without an explicit user decision.
> 9. System yank updates the Vim register independently from asynchronous clipboard success.
> 10. The selected model determines the agent source; the engine is never persisted separately.
> 11. Agent backends translate native output into `AgentEvent`; UI and chat state do not consume raw engine output.
> 12. `useChatStore`, chat persistence, and chat-history view state remain distinct concepts.
> 13. Chat-file parsing and serialization own the format while persistence owns storage.
> 14. Resume prompts are used only when backend session memory cannot be relied upon.
>
> - **Why:** Durable invariants survive refactors better than lists of current consumers and imports.

> **Step 7 - Tighten flagged ambiguities**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Retain and shorten the distinctions for global versus editor Vim mode, adapter versus backend, hidden sidebar versus folded directory, entry draft versus dirty editor buffer, engine versus model, and the three meanings of chat store.
> - Add a buffer-versus-tab distinction: `EditorBuffer` is session state; an editor tab is its UI representation.
> - Remove the `ChatMessage.role` accessibility implementation note.
> - Remove the obsolete `--fab-accent` migration ambiguity; its current legacy status belongs in the concise accent definition.
> - **Why:** The ambiguity section should prevent naming mistakes, not preserve isolated lint or migration history.

> **Step 8 - Preserve and clarify the Changelog**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Add a note immediately below the heading:
>
> ```markdown
> > Historical record only. Entries may describe superseded behavior;
> > the definitions and invariants above are authoritative for current code.
> ```
>
> - Remove the `[YYYY-MM-DD] | Initial scaffold` placeholder.
> - Preserve all real dated rows as historical records.
> - Append a `2026-07-22` row describing the glossary restructuring, current-state corrections, and rule clarification.
> - Do not duplicate the cleanup summary in `Last updated`.
> - **Why:** History remains available without competing with current canonical definitions.

> **Step 9 - Validate the documentation-only change**
>
> - **Files:** `.agents/ubiquitous-language.md`, `.agents/rules/domain-glossary.md`
> - **Action:** VERIFY
> - **Details:** Search for removed stale phrases and verify they no longer appear in current definitions: `> Prior`, `saveIntent`, `markSaved`, `useEditorStore.filePath`, `only consumer`, `will be the later`, and `for one release`.
> - Confirm every retained term appears exactly once in the vocabulary tables.
> - Confirm referenced file paths and canonical symbols exist.
> - Confirm Markdown tables render correctly and `Last updated` contains only `2026-07-22`.
> - Run `git diff --check`.
> - Run `pnpm check`.
> - Confirm no files under `src/` or `src-tauri/` changed.
> - **Why:** The result must be internally consistent, source-aligned, and limited to documentation governance.

## Architecture Decisions

- Keep one glossary file rather than splitting it, preserving the existing single-source-of-truth workflow.
- Preserve technical vocabulary when it establishes canonical naming, state ownership, a data contract, or a durable invariant.
- Remove implementation details that can be discovered from source and are likely to become stale.
- Keep historical Changelog rows, but explicitly separate them from current truth.
- Update the governing rule as part of the cleanup so future changes follow the same boundaries.
- Do not retire legacy CSS aliases or modify production comments in this cleanup; accurately documenting or omitting them is sufficient.
- Prefer concise tables by domain over one large alphabetic or implementation-order table.

## Validation Criteria

- [ ] The malformed `Last updated` history block is replaced by compact metadata.
- [ ] Vocabulary is grouped into the seven planned sections.
- [ ] Removed APIs and false consumer/import claims no longer appear as current behavior.
- [ ] `find-file`, immutable save requests, buffer deduplication, model-switch resume behavior, and filesystem containment match current source.
- [ ] `Invariants and relationships` contains durable contracts rather than caller graphs.
- [ ] Flagged ambiguities contain only meaningful naming distinctions.
- [ ] Existing dated Changelog rows remain intact and are marked historical.
- [ ] The domain-glossary rule defines explicit inclusion and exclusion criteria.
- [ ] `git diff --check` passes.
- [ ] `pnpm check` passes.
- [ ] No production source files are modified.

## Open Questions

None. The cleanup scope and rule update were confirmed during planning.
