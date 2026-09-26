# Spec: Smooth Motion and Resizable Panels

> Status: **settled**
> Created: 2026-09-26
> Grilled: 2026-09-26 — 3 rounds, 27 decisions
> Suggested next: /spec-breakdown

## Goal

Make the app stop feeling clunky: give panels, overlays, lists and long scrolls a short, mechanical
motion vocabulary in place of today's instant jumps. Let the expanded sidebar and the *agent panel*
be resized with the mouse, for whoever prefers it, without changing anything for whoever does not.

Today there is no animation library and no `prefers-reduced-motion` handling. There are 18
scattered transitions, mostly colour and one chevron rotate. The "standard" fade is spelled three
ways: `--dur` is 180ms, the design skill says 150ms, and the toast's `FADE_MS` is 160ms, which cuts
its own fade short. Every overlay returns `null` in the same commit that closes it. Panel widths
are fixed tokens (224 / 40 / 340px), and no layout state is persisted.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | What character of motion does the app adopt? | **Mechanical, widened**: fades, short translates and real width transitions; no bounce, spring or stagger | Keeps the calm, keyboard-first voice. "Fades only" could not touch what feels worst: a panel landing 340px wide in one frame. Supersedes the design skill's "150ms fades only" and decision 22 of the collapsible-rail spec (ADR 0133) |
| 2 | Which groups of surfaces animate? | **Panels** (sidebar ↔ *sidebar rail*, *agent panel* open/close), **overlays** (the *modal shell*'s four dialogs, `SettingsDialog`, *file finder*, *sidebar context menu*, *Tooltip*, toasts), **lists** (tree rows, tab chips, transcript items, toast reflow), **scroll** (the *read view*'s jumps, chat auto-scroll) | The user added scroll to the recommended three. Anything outside these groups and decision 22 stays instant |
| 3 | Do keyboard hot paths animate? | **No — they stay instant**: tab switch, the *view toggle*, a keyboard cursor, `Ctrl-w` region moves, opening a buffer | They run dozens of times a minute, so any motion there reads as latency. The read-view spec already calls the toggle an instant preview. Recorded in ADR 0133's consequences |
| 4 | May an animation delay input? | **Never — new product invariant 60** | State changes stay synchronous. An element in its *exit phase* is inert at once: its modal overlay is popped, focus has moved and pointer events are off. An entering element takes keys from its first frame. Without this, a closing modal would keep swallowing keys for 180ms |
| 5 | Is reduced motion honoured? | **The macOS setting only**: under Reduce Motion, movement, width and scroll become instant and short fades remain. No `settings.toml` key | One user and one machine; the OS switch already exists |
| 6 | How are panels resized? | **Mouse drag, and a double click resets to the default** (224 / 340). "Side chat" is the *agent panel*; the rail stays fixed at 40px | "If one prefers": defaults do not change, so someone who never drags notices nothing. A keyboard path is out of scope |
| 7 | Is a width remembered across launches? | **Yes, in `settings.toml`, like `contentZoom`**: `sidebarWidth` / `agentWidth`, written only on pointer release or double click, falling back silently to the default when absent or out of range. Collapsed/open stays unpersisted (ADR 0109) | `contentZoom` is the precedent for view state that a gesture writes, and it degrades silently so upgrades never toast. The file stays the single source of truth (ADR 0101) |
| 8 | What width range? | **Sidebar 180–420px, agent panel 280–640px, viewer floor 400px**; when space runs short the agent panel yields first, then the sidebar | 180 keeps the traffic lights (zoom button's right edge at 73) and the back/forward pair clear. The floor is soft (decision 27) |
| 9 | What happens below a minimum? | **The sidebar snaps to the rail, and the rail's edge drags back out; the agent panel stops at its minimum** | A closed agent panel has no edge to drag back from, so a snap-close there would be a one-way door |
| 10 | What does the drag target look like? | **Invisible until hovered**: a ~8px zone on the seam, `col-resize`, and a 1px `--border-strong` line after ~150ms of hover and throughout a drag. Monochrome, never ember | Invariant 21. The *inset card*'s hairline already draws the seam at rest |
| 11 | Which animation engine? | **Motion (`motion/react`, MIT)**. Not GSAP 3.15, and not CSS plus an in-house primitive | The hard part here is React's lifecycle: keeping ~10 overlays and keyed list items mounted while they leave, and reflowing their neighbours. `AnimatePresence` and `layout` solve that declaratively. GSAP excels at tweening and timelines, the easy part, and would need a hand-written presence layer of ~100–150 lines. GSAP stays defensible if lifecycle control or choreography ever outweighs code volume. A GSAP-plus-Motion hybrid was rejected: two engines and two token mirrors. The user declined an ADR for this choice |
| 12 | How do panels animate? | **A real width tween** (`--dur-slow`), with the explorer and the rail crossfading while it runs. The snap to the rail and the double-click reset reuse it; a live drag follows the pointer 1:1 with no transition. Opening and closing the *agent panel* tween its width the same way | Sliding over the viewer and resizing at the end, or resizing first and sliding into the gap, each keep one jump. The per-frame CodeMirror re-wrap decision 22 feared is accepted, and measured on WKWebView before the panels slice closes (Residual Unknowns) |
| 13 | What scale of durations and curves? | **Three durations**: 120ms for state and hover, 180ms for overlays and lists, 240ms for panels and scroll. **Asymmetric curves**: enter decelerates (ease-out), exit accelerates (ease-in) and lasts ~70% of the enter | The enter/exit asymmetry is what makes motion read as smooth rather than floaty. It replaces today's 150 / 160 / 180 disagreement |
| 14 | How does an overlay enter? | **Fade plus a 4px translate**: dialogs and the finder rise, the context menu and the tooltip shift from their anchor, toasts rise from below; the scrim only fades. The *Tooltip* fades on a cold open and appears instantly inside its 300ms warm window | Enough movement to show where a thing came from. Scale was rejected as the popover idiom of a different platform |
| 15 | Tabs were a list, but opening a buffer is a hot path. What animates? | **Only the chip**: the editor or *read view* appears in frame 0 with focus, and the tab chip enters with width and fade. When a tab closes, its neighbours slide into the gap | Reconciles decisions 2 and 3: the content is the hot path, the chip is not |
| 16 | Which scrolls are smoothed? | **The big jumps**: `Ctrl-d`, `Ctrl-u`, `g g` and `G` animate in the read view; `j`/`k` step one line instantly. Chat auto-scroll is smooth and only follows when the transcript was already near the bottom. The edit view keeps CodeMirror's own scroll | With `j` held (~30 repeats/s), a 240ms line animation would trail the keyboard by several lines and brush invariant 60. Today the chat yanks to the bottom on every item, even when you have scrolled up |
| 17 | When the window narrows and a panel is clamped, what is saved? | **The preference**: the persisted *panel width* is what the user chose, and the clamp is render-only. Only a drag release or a double click writes | Widening the window again restores the chosen width |
| 18 | Do the widths appear in the Settings dialog? | **No** | A double click already resets, and the `settings.toml` template documents the keys. A row for something set by dragging adds nothing |
| 19 | Should a keyboard cursor transition, when pointer hover does? | **Keyboard cursor instant; pointer hover transitions at 120ms** — in the tree, the finder and the chat history | `FileTreeItem`'s 150ms background transition today animates the `j`/`k` cursor too, which decision 3 forbids |
| 20 | What are the canonical names? | ***Resize handle***, ***exit phase***, ***panel width*** (see Glossary Changes) | "Gutter" already names the *inset card*'s `--bg-panel` margin, and "pane"/"panel" are aliases the glossary avoids as region-state values |
| 21 | Which ADRs are written? | **ADR 0133, motion extends beyond fades.** The engine ADR was offered and declined | The vocabulary change reverses a design-system rule and a spec decision, so a reader would be surprised without it. The engine choice lives in decision 11 |
| 22 | Which surfaces outside the four groups animate? | **All four offered**: the *home surface* fades in on arrival (when the last buffer closes, never when one opens); the *agent dock* crossfades with the *agent panel*; the agent panel's Chat ↔ History tabs crossfade, with both present and the outgoing one inert; the theme switch crossfades | The user widened scope beyond the recommended two. The dock's 124px slot is already reserved, so its crossfade moves nothing |
| 23 | Where does the snap threshold sit, and what does expanding restore? | **At 110px, midway between the rail (40) and the minimum (180).** Between 180 and 110 the sidebar holds at 180; below 110 it snaps to the rail. Dragging the rail past 110 expands it, following the pointer (≥180). Expanding with the toggle restores the saved *panel width* | A dead zone between the minimum and the snap stops a slightly-too-far drag from collapsing the sidebar |
| 24 | What are the new tokens called? | **`--dur-fast` / `--dur` / `--dur-slow`, plus `--ease-out` / `--ease-in`**. `--dur` and `--ease` keep their names and values (180ms, `cubic-bezier(0.4, 0, 0.2, 1)`) | A size scale leaves every existing `duration-[var(--dur)]` usage working |
| 25 | How does the theme crossfade? | **The View Transitions API**: `document.startViewTransition` around the `data-theme` flip, over `--dur-slow`, and instant where WebKit lacks it. Input lands during the snapshot and shows when it ends. Being a fade, it survives Reduce Motion (decision 5) | The compositor crossfades two snapshots at no per-element cost and never touches CodeMirror. A global colour transition would interpolate thousands of syntax spans at once |
| 26 | How do the tokens reach Motion without drifting? | **A TS mirror plus a parity test**: `src/lib/motion/tokens.ts` exports the durations and curves, and a Vitest test reads `motion.css` and fails when they differ | The 160-vs-180 toast drift is this exact failure, already shipped once. Reading CSS variables at runtime breaks under Vitest's `css: false` |
| 27 | When the window is too narrow for every floor, what gives? | **The viewer floor is soft**: panels yield to their minimums first, and only then does the viewer go below 400px. No window `minWidth`, and no state change caused by a window resize | A `minWidth` would forbid a narrow window even with both panels closed. Auto-closing or auto-collapsing would change state from a resize and never restore it |

## Explicitly Out of Scope

- **Keyboard resizing** — no `Ctrl-w <` / `Ctrl-w >` chords (decision 6). The *resize handle* is not
  focusable.
- **Persisting collapsed or open state.** ADR 0109's reasoning stands; only the widths persist
  (decision 7).
- **A widths row in the Settings dialog** (decision 18).
- **Smooth scrolling in the edit view.** CodeMirror owns it (decision 16).
- **Animating a `j`/`k` line step** (decision 16), or any keyboard hot path (decision 3).
- **Expressive motion**: springs, overshoot, bounce, staggered entrances (decision 1).
- **A `settings.toml` motion key** (decision 5).
- **GSAP**, and any GSAP-plus-Motion hybrid (decision 11).
- **A window `minWidth`**, and any auto-close or auto-collapse on a narrow window (decision 27).
- **Resizing the rail.** It stays 40px (decision 6).
- **Animating the initial render or a wholesale tree replacement** on a vault switch. Lists animate
  changes after mount, not the first paint.

## Glossary Changes

Terms resolved during this session, as glossary rows ready to promote. They are **not** written
into the glossary now: a term enters when its code lands (ADR 0127). The work that implements this
spec copies these rows across in the same commit that makes them true. Each row obeys the 600 B
one-claim ceiling it will be held to there (`.agents/rules/domain-glossary.md`). Canonical types
name the intended code, and the implementing slice corrects them if the plan names them otherwise.

| Term | Canonical type | Aliases to avoid | Notes | Destination file |
|------|----------------|------------------|-------|------------------|
| Resize handle | `ResizeHandle` (`src/components/layout/ResizeHandle.tsx`) | splitter, gutter, sash, divider | The ~8px mouse-only drag target on the expanded sidebar's right edge, the *sidebar rail*'s edge and the *agent panel*'s left edge. Invisible until hovered, then `col-resize` and a 1px `--border-strong` line, **never ember** (invariant 21). A drag follows the pointer 1:1 and writes the *panel width* on release; a double click resets it. Below 110px the sidebar snaps to the rail, and the rail drags back out. Not focusable. Distinct from the *inset card*'s gutter, the margin it sits in. | `.agents/ubiquitous-language.md` › Cross-cutting presentation vocabulary |
| Exit phase | an `AnimatePresence` child with `useIsPresent() === false` | unmounting, closing, fade-out state | The interval in which an element animates out while still in the DOM. It is **already inert** (`inert`, pointer events off, its modal overlay popped, focus moved), so nothing typed or clicked lands there (invariant 60). The state change that began it was synchronous; only the pixels lag. `toast.leaving` was its first instance. Distinct from closing, which is the state change, and from unmounting, which is where the exit phase ends. | `.agents/ubiquitous-language.md` › Cross-cutting presentation vocabulary |
| Panel width | `sidebarWidth` / `agentWidth` (`src-tauri/src/settings.rs`) | pane size, region width, sidebar size | The expanded sidebar's and the *agent panel*'s width **preference**: persisted in `settings.toml`, clamped to [180, 420] and [280, 640], default 224 and 340, written only by a *resize handle* release or double click. Distinct from the **effective** width. When the window narrows, the agent panel and then the sidebar yield toward their minimums at render time, the preference untouched, and only then does the viewer go below its soft 400px floor. The rail has no panel width. | `.agents/ubiquitous-language.md` › Application shell and commands |
| Motion tokens | `--dur-fast` / `--dur` / `--dur-slow`, `--ease` / `--ease-out` / `--ease-in` (`src/styles/tokens/motion.css`), mirrored in `src/lib/motion/tokens.ts` | hard-coded milliseconds, `FADE_MS`-style constants, "animation constants" | The only motion durations and curves: 120 / 180 / 240ms for state and hover, overlays and lists, panels and scroll. Enter decelerates on `--ease-out`; exit accelerates on `--ease-in` at ~70% of the enter duration; nothing bounces (ADR 0133). The TS mirror exists because Motion takes numbers, and a parity test fails the build when it drifts from the CSS. Under macOS Reduce Motion, movement, width and scroll become instant and only fades remain. | `.agents/ubiquitous-language.md` › Cross-cutting presentation vocabulary |

**New invariant**, destined for `.agents/ubiquitous-language-invariants.md`:

- **60. Motion never delays input.** Every state change is synchronous, and animation only
  presents it. An element in its *exit phase* is inert from its first frame, with its modal
  overlay popped, focus moved and pointer events off. An entering element takes keys from its
  first frame. Nothing waits for an animation to finish before it accepts input. The theme
  crossfade's snapshot is the one visual lag, and it is only visual: keys land during it and show
  when it ends (ADR 0133).

Amendments promoted in the same commits. Each row stays within 600 B:

- **Region visibility**: "`sidebarExpanded` toggles it between 224px and the 40px *sidebar rail*"
  becomes "`sidebarExpanded` toggles it between its *panel width* and the 40px *sidebar rail*".
- **Settings**: the persisted list gains "and both *panel widths*". "`contentZoom` alone degrades
  **silently**" becomes "`contentZoom` and the panel widths degrade **silently**". It would
  otherwise go false the moment the width keys land. To stay under budget, "unlike `vaultPath`'s
  empty-string sentinel" shortens to "unlike `vaultPath`'s", and "A hand-edited `[settings]`-wrapped
  document" to "A `[settings]`-wrapped document". Measured: 562 B.
- **Modal shell**: add "It pops that overlay as its *exit phase* begins, never at unmount
  (invariant 60)." Two drifts in the same row are corrected while it is being edited:
  - The shell sits behind **four** dialogs; `RenameEntryDialog` is missing from the row.
  - It does not register the `modal` keymap layer. `Layout` registers it once via
    `useModalKeymap`, and the shell only pushes an overlay entry that activates it. Reword to
    "Named for the `modal` *keymap layer* its overlay activates".

  The row is at 601 B today, so both additions need room:
  - Drop the historical clause "which finally makes the latter two escapable and stops them
    leaking region chords".
  - Shorten the Enter clauses to "only when one confirm action is unambiguous, so Enter never
    means "Save all"" and "never a button, which would fire twice on one Enter".

  Measured: 562 B.
- **Content zoom**: "chrome, the sidebar and dialogs never resize" becomes "… never scale". The
  sidebar now resizes; what it never does is zoom.

Then follow the post-edit procedure:
- Set `Last updated` on `.agents/ubiquitous-language.md` and `.agents/ubiquitous-language-invariants.md`.
- Add a Changelog row.
- Regenerate `.agents/ubiquitous-language-index.md`.

The motion line of `.agents/skills/acidanthera-design/SKILL.md` changes too:
- "Use 150ms fades only. Never bounce." becomes the widened vocabulary, the three tokens and the
  hot-path carve-out.
- The skill's "`Modal` … registers the modal keymap layer" gets the same correction as the
  glossary row.
- ADR 0129 gains a seventh divergence entry recording both changes.

## ADRs Raised

- `.agents/adr/0133-motion-extends-beyond-fades.md`: motion extends beyond fades. It supersedes the
  design skill's fades-only line and decision 22 of
  `.agents/specs/2026-08-08-collapsible-sidebar-rail.md`.

## Residual Unknowns

- **CodeMirror re-wrap cost during the width tween** (decision 12). `EditorView.lineWrapping` is on,
  so the viewer re-wraps on every frame of a 240ms tween. Measure it on the shipped WKWebView with a
  long note open before the panels slice closes. If it janks, the fallback is not pre-decided: it
  returns to the user as a decision, not an implementer's call.
- **View Transitions support in the shipped WebKit** (decision 25). Confirm
  `document.startViewTransition` exists at runtime; decision 25 already prescribes the instant
  fallback.
- **Reduce Motion does not cover width or scroll in Motion.** `MotionConfig reducedMotion="user"`
  disables transform and layout animation but not a `width` tween or a scroll. Those two read
  `useReducedMotion()` explicitly. This is a plan-level fact, recorded so it is not rediscovered.
- **Tests that assume synchronous unmount**: `modal.test.tsx`, `FileFinder.test.tsx`,
  `CloseBufferDialog.test.tsx`, `switch-vault.test.tsx`, `SidebarContextMenu.test.tsx`, and
  `EditorTabs.test.tsx:58-59` (the close `×` transition class). With
  `MotionGlobalConfig.skipAnimations` in the Vitest setup, some may still need to await one frame.
  The test strategy is the plan's; invariant 60's inertness must stay asserted synchronously.
- **Close-then-reopen races.** The promise-gate dialogs clear their content (`pending: null`) in the
  same update as the close, so an exiting dialog has no data left to render. Presence needs the last
  content held for the exit phase. That is a plan-level mechanism, not a design question.
- **Shared overlay motion.** `SettingsDialog`, the *file finder* and the *sidebar context menu*
  hand-roll their scrims. Whether they share one motion wrapper with the *modal shell* is a plan
  choice. Moving them onto the shell is **not** implied, because each blocks keys its own way
  (invariant 25).
- **The sidebar's two subtrees.** `Sidebar` returns a different `<aside>` for the rail and the
  explorer. The crossfade needs both mounted for the tween's length, and the chrome strip's
  `leftInset` must follow the animated width rather than the `sidebarExpanded` boolean and its
  hard-coded 224 / 40 constants.
- **Drift found and not decided.** `ToastHost`'s comment says toasts paint above the modal scrim,
  but the shell's `z-20` scrim paints above them. `EntryDraftRow`'s chevron carries a transition
  that never fires. Neither was put to the user; the overlays and lists slices meet both.
