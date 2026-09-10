# Spec: Home Surface and Agent Dock

> Status: **settled**
> Created: 2026-09-09
> Grilled: 2026-09-09 — 3 rounds, 34 decisions
> Suggested next: /spec-breakdown

## Goal

Turn the zero-buffer viewer from a static empty state into a **home surface** — brand mark,
greeting, three action rows, and a docked agent composer — and make the two verbs it advertises
real. Source: mockups 5a (dark) / 5b (light), "Acidanthera — empty vault / home, reworked",
themselves a rework of `1g` from the 2026-08-08 design-system session.

## The reversal this rests on

`.agents/specs/2026-08-08-orbit-design-system.md` settled decision 13 as *"Empty vault state —
Design copy + vault path, no action cards"* and listed **"Onboarding action cards (1g)"** under
*Explicitly Out of Scope*, on two grounds: two of the three verbs pointed at features that did
not exist, and `doc/v0-spec.md` §1 states "No onboarding".

That ruling is **superseded**, on a narrower basis than the mockup claims. This is not
onboarding — the app has one user and always will. It is the app's **home surface**: what that
user looks at every time no note is open. The 2026-08-08 objection was never "a home surface is
wrong", it was "two of these three buttons are lies", and this spec answers that objection
directly: one verb is built (daily note), one is reframed onto behavior that already exists
(open an existing vault), and none ships as a placeholder.

## Settled Decisions

### The surface

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Does decision 13 stand? | Superseded — ship the home surface | Not onboarding but a home surface; the original objection was the fake verbs, which this spec removes |
| 2 | Which condition does it cover? | Every zero-buffer state, three states, one surface | A home surface that vanishes once you own one note is the least useful version of it; the rows are as wanted on day 300 as day 1 |
| 3 | The three states | no vault / empty vault / has notes — only the greeting and row set change | `Viewer.tsx:81` already branched two of these; the third (`vaultRoot === null`) was undrawn and previously rendered a blank path line |
| 4 | No-vault state | Its own greeting, the open-vault row alone, **no dock** | New note and daily note are impossible without a root, and `sendMessage` could only produce an error item |
| 5 | Composition | Dock pinned to the card's bottom edge in its own gutter; mark/greeting/rows centered in the space above | The gap is what makes the dock read as a persistent way in rather than a fourth action row |
| 6 | Brand treatment | Mark **above** the wordmark | ADR 0036 makes the ember ring correct wherever the mark renders |
| 7 | Greeting | `Your vault is empty.` — drop `Good — clean slate.` | The mockup's shorter line; the second clause was a joke that reads once |
| 8 | Subtitle | `Everything stays local — plain markdown in <path>`, with `displayPath(vaultRoot)` inlined in mono | Never the literal `~/acidanthera`; folds today's separate path line into the sentence |
| 9 | Row component | Its own, not `NavRow`, not `Button` | ~44px bordered rows at ~400px on canvas vs. NavRow's 33px unbordered row in a 224px panel; one component for both means props for border, height, width and ground |

### The three rows

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 10 | Row 1 | `Write your first note` → the **existing sidebar draft** (`startDraft`), expanding the sidebar first if collapsed | One behavior per command however invoked — the rule the create pair already follows. Accepted cost: the focus jumps to the sidebar's inline input |
| 11 | Row 2 | `Start today's daily note` → `global.daily-note` | Built as a real feature — see below |
| 12 | Row 3 | `Import notes` reframed to `Open an existing vault` → the existing `pickAndPersistVault()` | `v0-spec` §2 already says the app opens an existing Obsidian vault and coexists with it, so "import" is solved by pointing the vault at that folder. One line of wiring instead of three importers |
| 13 | Row 3 trailing copy | `Obsidian-compatible · plain markdown` | Keeps the mockup's reassurance-in-the-trailing-slot pattern and says something true |

### Daily note (new feature)

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 14 | Location | `<vault>/<dailyNoteFolder>/`, default `daily`, overridable in `settings.toml`, folder auto-created | The most personal choice in the feature; `settings.toml` already degrades per-key on a missing or invalid value, and retrofitting the key later means migrating notes already filed in the wrong place |
| 15 | Filename | `YYYY-MM-DD.md`, **hardcoded** | ISO 8601, so lexicographic sidebar order is chronological order for free. A user-supplied format string is a parser plus a round-trip guarantee, not a setting — and the command must parse the name back to find today's note before creating it |
| 16 | Initial content | **Empty** | Exactly what `create_note` already produces; no new file-content convention anywhere in the app, and a heading is one keystroke |
| 17 | Behavior | Find-or-create, then open through `openVaultFile` | Opening an existing daily note and creating today's are one gesture |

### Keyboard

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 18 | Chord literals | Refused — every hint reads from the resolved keymap via `useCommandChord` | Invariant 31. The mockup's `⌘N`/`⌘D`/`⌘L` were also refused in the 2026-09-08 session |
| 19 | Layer | Promote the verbs: add `global.new-note` and `global.daily-note` | `sidebar.new-note` is `a`, a **sidebar-layer** chord that does not fire while the viewer is focused — which is exactly where this surface lives. Without this the surface advertises a key that does nothing from where you are standing |
| 20 | Dispatch | Give `executeAppCommand` its 2nd, 3rd and 4th real cases | It still implements 1 of 23 commands |
| 21 | Default chords | `Ctrl-w n`, `Ctrl-w d` | Consistent with every other global binding (`Ctrl-w f/b/c/s`), both letters free, mnemonic |
| 22 | Two bindings per verb | `sidebar.new-note` (`a`) and `global.new-note` (`Ctrl-w n`) coexist; **each surface renders whichever chord fires where it is drawn** | The nav row keeps the faster single key that genuinely works there; the home row shows the only one that works from the viewer |
| 23 | Focus model | Viewer region + no buffer open → DOM focus lands in the dock. **No fourth focus region** | The dock is the only focusable thing in the card, so this is invariant 20 holding rather than bending. Rows are reached by their global chords and by click, as the nav rows are |

### The agent dock

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 24 | What it is | A second mount of `ChatInput` — one transcript, never two. Submit calls `openAgent()` then sends | ADR 0038. `sendMessage` never checks `agentOpen`, so a dock that sent without opening would stream a real turn into an unmounted transcript |
| 25 | While the panel is open | Hidden | Two composers addressing one transcript is the confusion to avoid |
| 26 | Difference from the panel's input | One new `placeholder` prop; send control identical | The dock is a cold-start invitation, the panel a running conversation — the placeholder is the one thing that should differ. A second Button shape for one call site is not |
| 27 | `ChatInput`'s `kbd="⌘⏎"` | Corrected to `⏎` in both mounts | The handler fires on bare `Enter`; the literal is false. Chat submit is deliberately **not** an app command (in-input handlers are out of `APP_COMMANDS`' scope), so it cannot be keymap-derived — the honest fix is the right literal |

### Sidebar

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 28 | Primary nav | Add `Daily note`; **keep `New folder`** — four rows | The mockup's three-row nav reads as simplification, not decision; dropping New folder leaves folder creation on `Shift+A` and the context menu only |
| 29 | Empty tree | Adopt `Nothing here yet.` — one muted line at the tree's `px-[14px]` gutter, styled like `FileFinder`'s `no matching notes.` | Not a cursor row, not in `flattenVisibleTree` |
| 30 | Footer meta | Keep `N notes`; **refuse `new vault`** | Nothing tracks a vault's age, and `0 notes` already says the only true thing that token gestured at |
| 31 | Footer control | **☀ theme toggle replaces ⚙** | Chosen against the recommendation. Persists through the same `useSettingsStore.updateSettings` the dialog's `Segmented` calls — one write path, two call sites, so ADR 0003 keeps `settings.toml` authoritative. Disabled while a `Syntax` diagnostic is present, exactly as the dialog rows are. Icon reflects the current theme (Sun in dark, Moon in light) |
| 32 | Settings rehomed | **⚙ moves to the brand row**, beside `⌕` and the collapse toggle | ADR 0035 requires every global control to live in the sidebar; without this, decision 31 would leave Settings keyboard-only while expanded |
| 33 | The rail | Mirrors both — `⚙` joins the icon stack, `☀` becomes the bottom pin | Applies ADR 0035's rule rather than its literal outcome: the rail carries what the expanded sidebar's hidden surfaces carry. The bottom pin stands in for the footer, which is what the footer now holds |

### Navigation history (new feature)

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 34 | Build it | Yes — back/forward controls in the sidebar's chrome strip | Chosen against the recommendation. Reverses ADR 0035's "no controls" clause — recorded in ADR 0037 rather than broken quietly |
| 35 | What is an entry | **Buffer activations only** | What those arrows mean in every app that has them. Opening a note, switching tabs and the finder all push; sidebar cursor movement and folder expansion do not, since neither changes what you are reading |
| 36 | Chords | **None — pointer only** | Chosen against the recommendation (`Ctrl-w o` / `Ctrl-w i`, mirroring vim's jumplist, was recommended). Consequence stated below |
| 37 | Vault switch | Stack cleared | Every entry points into a vault that is no longer open; clearing matches what already happens to the buffers those entries addressed |
| 38 | Icons | `ArrowLeft` / `ArrowRight`, not chevrons | The mockup draws `‹ ›`, but `ChevronLeft` is already the sidebar's *collapse* icon ~40px below in the brand row — two identical glyphs meaning different things in one 224px column |

### Cleanup carried by this work

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 39 | `hasVaultNotes` vs `countNotes` | Consolidate on `countNotes` | Two helpers answering overlapping questions about the same tree in two files. The sidebar already counts the whole tree every render, so `Viewer.tsx:16`'s short-circuit saves nothing measurable while costing a second concept |
| 40 | New Lucide re-exports | `Sun`, `Moon`, `CalendarDays`, `FolderOpen`, `ArrowLeft`, `ArrowRight` | All through the `Icon` primitive (ADR 0017, invariant 30) |

## Explicitly Out of Scope

- **A real notes importer.** Markdown, Obsidian and Notion is three importers plus conflict
  handling and attachments. Decision 12 reframes the row onto behavior that exists; a genuine
  importer is its own epic if it is ever wanted.
- **`new vault` as a footer state.** Decision 30. Nothing knows a vault's age; adopting the
  token means inventing state, a threshold, and somewhere to persist it.
- **A configurable daily-note filename format.** Decision 15 — the command has to parse the name
  back to find today's note, so a user-supplied format is a parser with a round-trip guarantee.
- **A daily-note template.** Decision 16. A template file under `.acidanthera/` would be a second
  on-disk convention beside chats; empty matches `create_note` exactly.
- **A fourth focus region for the home rows.** Decision 23 — rewriting `reachableRegions` and the
  `Ctrl-w` cycle for a surface you leave the moment you use it.
- **A second transcript.** ADR 0038. The dock never renders a conversation.
- **An icon-only send button.** Decision 26 keeps one send control across both mounts.
- **Chords for back/forward.** Decision 36, chosen deliberately. Two `APP_COMMANDS` entries and
  two `DEFAULT_KEYMAP` lines would reverse it.
- **Back/forward on the collapsed rail.** Decision 33 mirrors `⚙` and `☀` only. A navigation
  control with no visible destination does not earn a tooltip-identified 40px glyph.

## Glossary Changes

Added to `.agents/ubiquitous-language.md`: *home surface*, *home row*, *agent dock*, *daily
note*, *navigation history*, *theme toggle*. Amended: *chrome strip* (admits view-scoped
controls), *primary nav* (four rows; `Daily note` is now built), *sidebar rail* (`⚙` in the
stack, `☀` pinned), *footer identity block* (`☀` replaces `⚙`), *empty editor state* (superseded
by *home surface*), *app command* (`global.new-note`, `global.daily-note`), *chord hint* (a verb
in two layers). Invariants 33–35 added and the scaffold block renumbered 36–53; invariant 23
amended.

## ADRs Raised

- `.agents/adr/0037-chrome-strip-admits-controls.md` — The chrome strip admits controls
- `.agents/adr/0038-one-transcript-composers-route-to-it.md` — One transcript; every composer routes to it

Considered and skipped: *a verb may live in two keymap layers* (decision 22) and *the
zero-buffer viewer is a home surface* (decision 1). Both are recorded as invariants; neither is
hard enough to reverse to earn an ADR, and `adr.md` asks for them sparingly.

## Residual Unknowns

**None** — the frontier emptied cleanly. Two consequences are recorded rather than unresolved:

- **Decision 36 leaves back/forward as the app's first keyboard-unreachable navigation
  gesture**, against `doc/v0-spec.md` §5.5's "the whole app usable with the keyboard only".
  Stated at the interrogation, chosen anyway, reversible in two `APP_COMMANDS` entries.
- **Decision 10's focus jump**: activating `Write your first note` from a centered home row
  lands the caret in the sidebar's inline name input, in another region. Accepted to keep one
  behavior per command rather than inventing a second create path.
