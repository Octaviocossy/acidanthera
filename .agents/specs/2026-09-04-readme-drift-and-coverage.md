# Spec: README drift correction and feature coverage

> Status: **settled**
> Created: 2026-09-04
> Grilled: 2026-09-04 — 3 rounds, 14 decisions
> Suggested next: /create-issue

## Goal

Correct every stale fact in `README.md`, document the two epics that shipped after it was
written (the sidebar context-menu rework and the collapsible rail), and fix the same drift
where it repeats itself in `doc/keybindings.md` and `doc/tech-stack.md`. Documentation only —
no code, no glossary change, no ADR.

## Verified Drift

Every item below was checked against the tree during the interrogation, not assumed.

### `README.md`

| Claim | Reality |
|-------|---------|
| `.agents/commands/` — "13 cross-agent slash commands" | 15 |
| `.agents/skills/` — "5 skills" | 6 |
| `.agents/adr/` — "11 architecture decision records" | 33 |
| `lib.rs` — "19 commands" | 24 |
| `components/ai/` — "FAB, transcript, input, tool chips, history" | The FAB was retired to the titlebar *chat toggle*; the directory holds `ChatHistoryList`, `ChatInput`, `ChatMessage`, `ThinkingIndicator`, `ToolChip` |
| `ui/` — "(button, badge, chip, kbd, …)" | `badge.tsx` was deleted; the directory holds `button`, `chip`, `icon`, `kbd`, `modal`, `section-label`, `segmented`, `switch` |
| `src-tauri/src/` tree | Missing `wikilink.rs` |
| `src/lib/` tree | Missing `dom/` |
| `components/vault/` — "file-tree rows, entry drafts, glyphs" | Also holds `SidebarContextMenu`, `InlineNameInput` |
| `.agents/rules/` — "planning, testing, glossary, ADRs, orchestration" | Omits design-interrogation, command-creation, skill-creation, issue-resolution |
| Dispatcher order — "editor → active region → global" | `LAYER_PRECEDENCE` (`src/lib/keymap/dispatcher.ts:211`) is `['modal', 'sidebar', 'chat.history', 'global']`; `modal` is missing from the sentence |
| Sidebar chord table — `j k l h a A` | Missing `r` (rename), `D` (duplicate), `d` `d` (delete); the whole `modal` layer is undocumented |
| Features › Vault | Predates the context-menu epic entirely: no context menu, rename, wikilink rewrite, duplicate, or delete-to-Trash |
| Features | No mention of the *sidebar rail* |

### `doc/keybindings.md`

| Claim | Reality |
|-------|---------|
| `r` — "Registered for the upcoming rename flow" | Rename is fully wired: `RenameEntryDialog`, `renameVaultEntry`, `Sidebar.tsx:175` |
| Precedence — "the editor…, then the active region…, then global" | Same `modal` omission as the README |
| — | The `modal` layer (`modal.confirm` = `enter`, `modal.cancel` = `escape`) is rebindable and entirely absent from the reference |

### `doc/tech-stack.md`

| Claim | Reality |
|-------|---------|
| `class-variance-authority` — "for `src/components/ui/{button,badge}.tsx`" | `badge.tsx` was deleted |
| Backend module table | Missing `wikilink.rs` |
| `serde_json` — "JSON (settings file, agent stream parsing)" | Imprecise. The live settings file is TOML (#96), but `serde_json` still serves `read_legacy_json_settings` (the one-time `settings.json` migration) plus IPC serialization across `agent.rs`, `chats.rs`, `config.rs` and `vault.rs` — so the row needs rewording, not the deletion an earlier reading suggested |
| "snapshot as of 2026-08-08" | Every version entry re-verified against `package.json` and `Cargo.toml` during this session and found correct |

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | What the update is for | **Drift correction + feature coverage.** Fix every stale fact *and* write the shipped-but-undocumented features into Features. Not a repositioning | The counts are a five-minute fix; the real gap is that a reader evaluating the app sees a sidebar that only creates files. The structure is fine — it is the contents that aged |
| 2 | Where it lands | A new **`docs:` issue, opened after #134 lands** | #134's spec scoped `README.md` to decision 12 (the `<picture>` hero) only; a content rewrite inside it makes the rebrand diff unreviewable and the review gate's Spec axis would correctly flag it as out of scope. Branching from `main` now would collide with #134's own uncommitted README edits — the order is load-bearing, not just the split |
| 3 | The stale counts | **Drop the numbers.** Rows describe contents, not quantities | Three of five rows were wrong within weeks and nothing enforces them. The row's value is *what is in here*, not *how many*. Enforcing them in `verify-scaffold.sh` was rejected: it would fail CI every time someone adds an ADR, punishing exactly the behavior the scaffold wants |
| 4 | README chord tables vs. `doc/keybindings.md` | **Trim the README to one essentials table plus the link**, and fix `doc/keybindings.md` in the same change | A reader should feel the keyboard model without leaving the README, but two full references means two things to drift — and both already have |
| 5 | The screenshot TODO | **Leave in place**, unresolved | Deliberately deferred again; the comment stays as the standing reminder |
| 6 | The Roadmap | **Unchanged** | Verified accurate: nothing has shipped off it, and `permission_request` plus the stable message id really are reserved in `agent-event.ts`. Adding wikilink click-through was offered and declined |
| 7 | `doc/tech-stack.md` | **In scope** — fix the three stale rows and move the snapshot date forward | It repeats two of the README's own stale facts and adds one of its own. The date bump is earned: every version entry was re-verified this session |
| 8 | Where the new features go | Context menu, rename, duplicate and delete-to-Trash **expand the Vault block**; the **sidebar rail goes under Keyboard-first** | All four are vault-entry operations and belong together. The rail is a layout behavior, not a file operation. A fifth bolded block was rejected — "the sidebar has a context menu" is not a peer of "Editor" or "Agent" |
| 9 | How much wikilink-rewrite behavior to state | **One sentence**: renaming a note rewrites the wikilinks that point at it, behind a confirmation that names them | The README's job is to make the behavior *expected*. The ambiguous-stem cancellation and the `N = 0` no-dialog rule are already precise in the glossary and ADR 0016 |
| 10 | The essentials-table cut | **One grouped table, 7 rows** — region cycling, finder, the three toggles, sidebar navigation, create, the three mutations, save | Collapses same-shape chords onto one row each, showing the whole keyboard model in about a third of the current 40 lines without becoming a second source of truth |
| 11 | `doc/keybindings.md` fix scope | **Rename status + the `modal` layer.** The context menu stays out | The modal layer is genuinely rebindable in `keymaps.toml` and simply missing from the reference. The context menu is a mouse surface and belongs in the README's Features |
| 12 | The `.agents/` inventory table | **Add a `.agents/scripts/` row**; `specs/` and `plans/` stay out | The prose directly below already promises a "zero-dependency POSIX `sh` and Markdown" toolchain that the table never shows. `specs/` and `plans/` are outputs of the loop rather than things a reader consults, and the workflow doc already explains them |
| 13 | Whether the agent section explains the machinery | **One sentence**, then the existing link | The section says what files exist but never what they do. One sentence naming the epic/child model and the two-axis review gate is what makes a reader click through; a bare directory table does not sell the link. A paragraph was rejected as a summary that would drift from the 258-line doc it summarizes |
| 14 | The OS Trash in "Where your data lives" | **One line under the table** — deleted notes go to the system Trash, no in-app undo, by design | It is the only place data leaves the vault, which makes "Nothing else is written anywhere" slightly incomplete, and the no-undo part is what a user needs to know before pressing `d` `d`. A `~/.Trash` table row was rejected: a system location the app does not own sits oddly beside three it does |

## Explicitly Out of Scope

- **`CONTRIBUTING.md`.** Audited in full during this session — testing conventions, Biome 2.2.0,
  the ember rule, the `/grill` → spec → route loop — and found accurate throughout. Do not
  touch it.
- **Resolving the screenshot TODO** (decision 5). The comment stays exactly as it is.
- **Any Roadmap change** (decision 6), including the wikilink click-through that was offered
  and declined.
- **The glossary.** No canonical vocabulary, entity, state, process or invariant changes here,
  so `.agents/ubiquitous-language.md` is untouched and its `Last updated` stays where it is.
- **Any code change.** Three Markdown files, nothing under `src/` or `src-tauri/`.
- **Documenting the context menu in `doc/keybindings.md`** (decision 11).
- **Re-auditing `doc/tech-stack.md`'s version tables.** Already verified correct this session;
  decision 7 covers three specific row corrections and the date, nothing more.
- **The following README sections, verified correct and deliberately unchanged:** the `<picture>`
  hero and badges, Requirements, Platform support, Install ("no prebuilt releases" — the repo
  has zero git tags), Quick start, the entire Configuration section including the `editorFont`
  default of `"JetBrains Mono"` (the glossary Changelog row claiming it became `Geist Mono`
  describes a state the code no longer holds; Changelog is historical-only, so nothing to fix),
  the model table, and Contributing.

## Glossary Changes

None.

## ADRs Raised

None. Nothing settled here passes the three-part test in `.agents/rules/adr.md` — dropping
counts from a README is a one-line reversal, and no decision is architecturally surprising or
carries a durable trade-off.

## Residual Unknowns

None. The frontier emptied cleanly.
