# Ubiquitous Language — Invariants

> Every invariant this repository commits to, **scaffold and product alike**. A breach of one is
> a **hard violation** at the review gate.
> Numbered so that code, specs and ADRs can cite one: **1–38** constrain the product
> (`src/`, `src-tauri/src/`), **39–57** the harness (`.agents/`, `.claude/`, `.opencode/`).
> Never renumber — the glossary, the skills and several ADRs cite them by number.
>
> **Last updated:** 2026-09-12
> **Budget:** notes 600 · warn 24576 · fail 32768 (bytes)

---

## Invariants and relationships

- **1.** Focus regions remain reachable only while their corresponding region is *usable*: the *agent panel* while it is open, the sidebar while it is **expanded** — not merely visible (see invariant 24).
- **2.** Global mode and editor Vim mode remain separate state machines.
- **3.** Keyboard layers dispatch shared app commands rather than duplicating command behavior.
- **4.** Vault filesystem operations remain contained within the canonical vault root and reject symlink escapes. The root is canonicalized **once, at the adopt boundary** — `guarded_path` receives an already-canonical root and canonicalizes only its target, so containment is established at one place rather than re-derived defensively on every call.
- **5.** Vault creation refreshes through the watcher; callers do not mutate the cached tree directly.
- **6.** Opening an already-buffered note activates it without replacing dirty in-memory content.
- **7.** Save requests are immutable snapshots processed in FIFO order, and completion applies only to the captured revision.
- **8.** Dirty buffer close cannot discard changes without an explicit user decision.
- **9.** System yank updates the Vim register independently from asynchronous clipboard success.
- **10.** The selected model determines the agent source; the engine is never persisted separately.
- **11.** Agent backends translate native output into `AgentEvent`; UI and chat state do not consume raw engine output.
- **12.** `useChatStore`, chat persistence, and chat-history view state remain distinct concepts.
- **13.** Chat-file parsing and serialization own the format while persistence owns storage.
- **14.** Resume prompts are used only when backend session memory cannot be relied upon.
- **15.** A `vaultPath` change is never applied while dirty buffers are unresolved without an explicit consolidated decision; Cancel leaves it un-applied.
- **16.** A config file's `EditorBufferSource` and its buffer's `filePath` decide save routing, editor language, and wikilink suppression together; no call site re-derives them from the path independently.
- **17.** A `config-changed` disk event never mutates an open config buffer's content, dirty or not — it only ever toasts a warning when the buffer is dirty (extends invariant 6).
- **18.** Keymap resolution replaces a command's chords wholesale; chord lists are never merged entry-by-entry, and an empty list unbinds.
- **19.** Keymap layers resolve in a single dispatcher, `editor > active region > global`, first match wins with no fallthrough.
- **20. Real DOM focus follows the focus region.** With `activeRegion === 'viewer'` it sits on whatever the viewer is showing: that buffer's CodeMirror view in edit, the *read view*'s container in read, the *agent dock* with no buffer open, released when the region moves. The claimant changes; the rule does not. Two of the three carry the *region-exit gesture*; the read view's container does not, a focused `div` being no editable target. Both are load-bearing: region focus without DOM focus leaves a note untypable, and DOM focus without it leaves other regions' keys landing in the buffer.
- **21. The AI accent marks AI agency, or a link into the vault**, and nothing else. No success state, status indicator or decorative fill may use it: an element rendering it claims that the agent acted there, that an AI action is offered but unavailable, or that this text navigates to another note. The *wikilink* clause is ADR 0126, widening ADR 0105's meaning; it applies in **both** views and only to a link that resolves (invariant 38). Two exemptions: the **brand mark**, identity rather than signal, whose ring renders wherever the mark does (supersedes ADR 0117), and the **dirty-note dot**.
- **22.** acidanthera token names are the only token vocabulary. Factory token names and aliases no longer exist.
- **23. There is no status bar and no titlebar.** Editor state renders inside the editor (the *editor status cluster*) and every global control lives in the sidebar (ADR 0107, extended by ADR 0121). The *chrome strip* carries **no state**, and the only controls it may carry are those acting on *what the window is currently showing*, today the *navigation history* pair and the *view toggle* (ADR 0123). A settings gear, a theme toggle and a create action are app-level and stay in the sidebar, which keeps the strip from drifting back into a titlebar one convenience at a time.
- **24. The sidebar is always visible and never unmounts**; collapsing it yields the *sidebar rail*. A collapsed rail is **not** a reachable focus region, having no visible cursor for `j`/`k`, so `collapseSidebar` moves `activeRegion` off `'sidebar'` and the cycle skips it (ADR 0109). Since ADR 0121 it is also the only surface several global controls have while collapsed, so it mirrors the expanded sidebar's hidden surfaces: `✦` and `⚙` in its stack, and the *theme toggle* `☀` as the bottom pin. Amends ADR 0109 decisions 18 and 20. The *navigation history* pair is **not** mirrored.
- **25.** While a `modal` layer is active it absorbs every keydown, matched or not, so no lower layer dispatches under an overlay (ADR 0112). Both the *sidebar context menu* and the *delete confirmation* register it, so `j`/`k`/`a`/`A`/`d d` are inert under either. Registration is the *modal shell*'s job, not each dialog's, which is what closes the leak for `CloseBufferDialog` and `SwitchVaultDialog`. `SettingsDialog` and `FileFinder` stay outside both: each already blocks keys its own way, a `stopPropagation` on the panel and a focused input that trips `isEditableTarget`.
- **26.** A vault deletion moves the entry to the OS trash and never calls `fs::remove_*`. It closes every editor buffer at or under the deleted path, and discards those buffers' unsaved edits only behind an explicit *delete confirmation* — which is why the confirmation is unconditional even though the file itself is recoverable from Finder.
- **27.** The *destructive color* marks the destructive path, and nothing else — the menu row that initiates it and the button that commits it (ADR 0113, narrowed). A failed operation stays monochrome. Together with invariant 21 this leaves the app exactly two colored fills — ember for "the AI acted here, or this navigates into the vault", red for "this click destroys" — and a UI element rendering either is asserting one of those things, with the brand mark's identity ring standing outside the pair rather than adding a third. ADR 0126 widened what ember means; it did not add a colour.
- **28.** Renaming a **note** rewrites every `[[wikilink]]` whose target is its old stem, unless that stem is ambiguous — two notes sharing it means nothing is rewritten and the user is told (ADR 0114). Renaming a **directory** rewrites nothing, because a wikilink target is a basename and carries no path. The rename lands first and is never rolled back; the rewrite that follows is best-effort and reports what it could not do.
- **29.** A rename never closes a buffer. Every buffer at or under the old path has its `filePath` rewritten in place, dirty ones included — the mirror of invariant 26, where deletion closes them, because deletion removes the file and a rename does not.
- **30.** Every drawn icon comes from Lucide through the `Icon` primitive (ADR 0115), which is the only place `strokeWidth={1.2}`/`absoluteStrokeWidth` is set. Hand-drawn SVG survives in exactly one component, `AcidantheraMarkGlyph`; the *Unicode glyph vocabulary* stays characters inside text and is not an exception to this, because it is typography.
- **31. Every user-facing chord comes from the *resolved keymap*.** No chord is written as a string literal: one is wrong the moment anyone edits `keymaps.toml`, and nothing in the app can notice. `formatChord` renders one hint, `formatChords` every chord a command has, and the `useCommandChord` **hook** supplies a control's chord, never a plain function since a `getState()` read in render survives no live-reload. The native-`title` path and `useChordTitle` are **gone** with the titlebar. The *primary nav* is the one surface rendering its chord **persistently**, as an unboxed `Kbd`.
- **32. A clipped surface carries a hover reveal, and inside the sidebar that reveal is drawn** (ADR 0120). `FileTreeItem` was the only truncating surface carrying none while four others followed the truncate-plus-`title` idiom. The *Tooltip* is deliberately **not** a modal layer, unlike every other overlay: invariant 25 would otherwise have it swallow `j`/`k` while the pointer merely rests on a row. Outside the sidebar the reveal is the native `title`; the *home row* is its one live consumer. The split is by construction: the *Tooltip* is anchored and mounted for the sidebar's own overflow.
- **33. The zero-buffer viewer is the *home surface*, never a blank canvas.** One component covers all three conditions, no vault, empty vault, vault with notes, and only the greeting and the row set change. It always offers something to do. This supersedes decision 13 of `.agents/specs/2026-08-08-orbit-design-system.md` and the "No onboarding" line in `doc/v0-spec.md` §1: the app has one user, so this is the surface that user sees whenever no note is open. What that ruling refused was verbs pointing at features that do not exist, and no *home row* may do that.
- **34. One transcript; every composer routes to it** (ADR 0124). The *agent dock* is a second mount of `ChatInput`, never a second conversation: submitting opens the *agent panel* and sends the turn there, and the dock hides while that panel is open. This is load-bearing rather than tidy — `useChatStore.sendMessage` reads only `vaultRoot` and never `agentOpen`, so a composer that sent without opening would start a real turn whose events stream into an unmounted transcript. Any further entry point obeys the same order: open, then send.
- **35. A verb may live in two *keymap layers*, and each surface renders whichever chord fires where it is drawn.** `sidebar.new-note` (`a`) and `global.new-note` (`Ctrl-w n`) are one action reachable two ways: the *primary nav* shows the single key that genuinely works there, the *home row* the global chord that is the only one working from the viewer. Both read from the *resolved keymap* (invariant 31); the rule is about which command a surface asks about, never about writing a literal. Collapsing the pair would either strand the home surface or cost the sidebar its single-key create.
- **36. One markdown parser serves both views** (ADR 0125). The *read view* walks the same `@lezer/markdown` tree the editor's `acidantheraHighlightStyle` binds against — never a second parser, and never an HTML string. Both halves are load-bearing: a second parser would let the two views disagree about what the source means, and an HTML string would need a sanitizer in an app where an agent writes the notes. Adding `react-markdown`, `marked`, or any `dangerouslySetInnerHTML` path for note content breaks this.
- **37. The *read view* renders; its only write is the task checkbox.** Clicking `- [ ]` rewrites that line through `updateBufferContent`, marks the buffer dirty, and commits through the existing `EditorSaveRequest` lifecycle — no second save path, no autosave, no direct disk write. Everything else that would edit a note belongs in the *edit view*. This is the boundary that stops the read view becoming a second editor with its own half of the save machinery.
- **38. A *wikilink* has three states, and they mean the same thing in both views** (ADR 0126). Resolving → ember and navigable; **missing or ambiguous** → muted, struck through, and inert. Ambiguity is *marked, never guessed*, extending ADR 0114's stance from renames to navigation: two notes sharing a basename means the link model cannot say which was meant. This is why the editor's decoration stopped being a pure regex and learned to resolve against the cached tree — a link reading as fine in edit and broken in read would be worse than either alone.
- **39. A command triad moves as a unit.** Renaming, adding, or deleting a slash command touches
  all three of its files in the same change; a partial triad fails the acceptance gate.
- **40. A review finding is a hard violation only if it breaches the glossary or an ADR.** Everything
  the Fowler smell baseline surfaces is a judgement call, no matter how confident the reviewer is.
  A documented repo standard overrides the baseline where the two disagree.
- **41. The Standards axis and the Spec axis are never merged or reranked against each other.** A
  change can pass one and fail the other; combining them lets the passing axis mask the failing
  one.
- **42. Axis isolation is blindness between findings, never exclusivity over sources.** The Standards
  and Spec sub-agents may be handed the same pre-read source material; what they must never see is
  each other's findings or a merged ranking of them.
- **43. The runner is the sole writer of the epic integration branch, on both execution paths.** A
  review gate changes *when* a child is merged, never *who* merges it — the agent only reads epic
  branch state and opens the final PR.
- **44. Review state is derived from git, never stored.** A child awaits review if its remote branch
  exists and the epic branch carries no `Merge child #N` for it; rework rounds are counted from
  commit markers. There is no durable state file to disagree with the repository.
- **45. Every child passes an agentic review before it can be integrated, on both execution paths.**
  What differs is who resolves a finding: on the supervised path a hard violation pre-selects
  rejection and the human decides; on the auto path it blocks integration and triggers rework
  directly. Never whether the review runs.
- **46. Both execution paths run one pipeline.** Run → review → optional rework → integrate. No path
  has a shortcut that merges without review — that is what removing the inline merge bought.
- **47. A rejection triggers rework; a merge conflict does not.** A conflict is an integration
  problem and goes to guided recovery in the child's direction; rework is for "this is not what I
  asked for."
- **48. The shape of a session is chosen at the call site, never in `.agents/parallel.config`.** That
  file is gitignored and per-machine, so it may hold operational knobs (concurrency, timeouts,
  caps) but nothing that decides whether a human is required.
- **49. A review gate never emits a merged verdict.** It presents both axes side by side and one
  objective **gate line** counting hard violations and judgement calls. Counting is not
  reranking; the moment a gate collapses the two axes into a single approve/reject, the passing
  axis starts masking the failing one.
- **50. Work is not done until an agentic review has seen it.** Under an epic that means before
  integration; interactively it means after the acceptance criteria pass and before
  `/execute-issue` reports completion. What varies across paths is who resolves a finding, never
  whether the review runs — with exactly one declared exception: `skip review` on the interactive
  path, which a human chooses at the call site and which must be stated in the final report. No
  path may skip the review by omission, by configuration, or silently.
- **51. A review report is an artifact, never review state.** Persisting one does not contradict
  "review state is derived from git": nothing reads a report back to decide what stage a change is
  at. The moment something did, the file could disagree with the repository — which is the
  failure ADR-0005 exists to prevent.
- **52. Every source a reviewer needs arrives by path, already materialized.** The corpus pack, the
  issue body, the plan, the design spec and the diff are all written to disk *before* the review
  prompt is built, on both paths. A reviewer sent to *find* a source has an unbounded search
  space, and the observed failure is not that it costs more but that it reads less and reports
  shallowly — or never returns. A wall-clock cap (`REVIEW_TIMEOUT` per reviewer attempt,
  `AGENT_TIMEOUT` per implementing agent) exists to catch that, never to make it tolerable.
- **53. An issue label is informational; nothing in the pipeline reads one back.** Neither execution
  path, the runner, nor the review gate branches on a label. The moment one did, GitHub would
  become a source of execution state that can disagree with the repository — which is exactly
  what "review state is derived from git, never stored" exists to prevent.
- **54. Labels are written at creation and corrected only by `/update-issue`.** `/create-issue` and
  `/spec-breakdown` set them; `/update-issue` may fix them, because correcting an inaccurate
  generation is what that command is for. `/ship-note`, `/comment-issue`, `/execute-issue` and
  `/handoff` still never send labels.
- **55. Applying a label is best-effort and never blocks issue creation.** A decorative metadatum must
  not be able to stop the issue from existing — and GitHub already behaves this way, silently
  dropping labels from a token without push access rather than failing the request.
- **56. A child never inherits its epic's labels.** Every issue is labelled from its own content;
  propagating the epic's labels down would give every child the same set and destroy the filter's
  value. The `> Epic: #<n>` body header is what groups them.
- **57. A scaffold sync never writes through a symlink, into a directory, or over one — at any
  component beneath the target root.** It replaces a link rather than following it, refuses to
  deliver over a directory, marks a divergence it cannot mark in place beside the path, and refuses
  every path beneath a non-directory ancestor before reading it — the whole run, when that
  ancestor is `.agents`, where the baseline lives. Reversing *never overwrites* (ADR-0019) is only
  safe under this rule: the sync may rewrite what the manifest says the scaffold authors, never
  what a path merely points at.
