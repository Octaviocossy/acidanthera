# acidanthera — Spec

> A desktop markdown notes app, **local-first** and **vim-first**, with a built-in AI agent.
> The goal is to eliminate the context-switch between the notes editor and the terminal where agents currently run.

| | |
|---|---|
| **Status** | In development (v0) |
| **Author** | Octavio Cossy Torquati |
| **Last revised** | 2026-07-05 |

---

## Table of contents

- [1. Context and philosophy](#1-context-and-philosophy)
- [2. Scope](#2-scope)
- [3. Architecture](#3-architecture)
- [4. Agent layer](#4-agent-layer)
- [5. Features](#5-features)
- [6. Workflow](#6-workflow)
- [7. Roadmap](#7-roadmap)
- [8. Decision log](#8-decision-log)

---

## 1. Context and philosophy

Personal tool, *scratch-your-own-itch* philosophy (Linus-style). Not a product for the market: design decisions are deliberately selfish (own aesthetic, own shortcuts, own workflow). Success metric: **daily personal use**. Possibly open source.

**Pain point driving the project.** Today the workflow spans two windows — a notes editor (Obsidian) and a terminal with an agent (Claude Code). The flow is: the agent generates material → it's pulled into the vault → it's manually distilled into atomic notes. The pain is switching between windows and copy-pasting. The goal is **everything in a single window**.

**User.** One only: the author. No onboarding, no accounts, no competing feature-by-feature with other apps.

---

## 2. Scope

### v0 (in development)
- Vim-first markdown editor over a local vault of plain `.md` files.
- File sidebar + central viewer + invocable agent panel.
- Agent via headless CLI (Claude Code **or** Codex), rendered as native UI.
- Zero auth, zero sync.

### Out of v0 (deferred)
- Graph view / neural tree (post-v0).
- Native-provider backends with an in-house tool loop (post-v0).
- Text streaming via deltas (evolution of the event contract).
- User auth and cross-device sync (v1+).
- Settings modal (v1+).
- Per-action permission approval (v2).

---

## 3. Architecture

### 3.1 Storage — plain markdown
Data is plain `.md` files in a filesystem folder (Obsidian philosophy). The app opens the existing Obsidian vault and **coexists** with it. Benefit: portability and interop for free.

**Design rule (invariant):** the source of truth is the plain markdown; everything else (link index, config, graph cache) is **reconstructible**. No critical state is stored outside the `.md` files. This enables v1 sync without a server (e.g. vault in iCloud/Dropbox/Syncthing) without reverting decisions.

### 3.2 Stack
- **Tauri (Rust)** over Electron: lighter, decent binary, and it forces real native backend work (learning / CV goal).
- **Frontend:** React + Vite.
- **Styling / design system:** Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first — no `tailwind.config.js`) + shadcn/ui primitives, skinned entirely by the **acidanthera Design System** from Claude Design project `d333dc32-6b35-4f89-9982-66bbc1014fcb` (see §5.6). We adopt shadcn's accessible *primitives*, not its default look. Lint/format stays on Biome; `cn()` uses `clsx` + `tailwind-merge`.
- **Native Rust backend:** filesystem, spawning the agent process, file-watching (`notify` crate). API-key management in the keychain is left for the native-provider backends (post-v0 — see §4).

### 3.3 Authentication and data — zero auth, zero sync (v0)
v0 has no user authentication and no synchronization: no login, no accounts, no server, no sync. Local single-user app.

- **Agent credentials:** the app does **not** build or manage auth. The v0 AgentBackends are CLIs (Claude Code, Codex) already logged in on their own; the app spawns the process and **inherits** that authentication. "Zero auth" does not limit functionality.
- **Deferred to v1+:** user auth and sync. When native-provider backends arrive, API keys go in the OS keychain and **never in the vault** (to avoid leaking them if it syncs).

### 3.4 Vim navigation — two separate levels
Vim is a pillar from day one. Two **deliberately separate** systems:

- **(a) Vim inside the editor** → `@replit/codemirror-vim` extension over CodeMirror 6. Handled by the lib (hjkl, insert/normal/visual modes, `:w`, etc.).
- **(b) App-level global vim** → navigating without a mouse between the layout regions (sidebar, viewer, agent when open). **Not a lib**: it's a custom focus-management + global keymap system (state machine: one active region, one global mode, plus the agent panel's open/closed state). It's the most custom piece of the project and is built **first**; the regions hang off it.

**CodeMirror coexistence rule** (what makes it "feel right"):
1. Outside the editor: the global layer handles everything (hjkl within the region, `:` for the command-line, region jumps).
2. Inside the editor: CodeMirror is in charge. A prefix is reserved (`Ctrl-w` + `h/j/k/l`, vim/tmux-style) as an exit toward other regions, implemented with top precedence in CM6 so the editor doesn't swallow it.
3. The editor is just another "mode" within the global state machine, not an island.

> Validated in a scaffold: the approach (focus/mode state machine first, `Ctrl-w` prefix reserved in CM6) works.

---

## 4. Agent layer

### 4.1 Provider ≠ Agent — two independent axes
Don't conflate two concepts into a single abstraction. There are **two independent axes of choice**:

- *Which loop runs:* an external agent that already brings its own, or an in-house loop against an API.
- *Which model responds:* Claude, GPT, etc.

When choosing an external agent, the model comes **tied** to its provider.

### 4.2 Backend families

| Family | What it is | Implementations | Status |
|---|---|---|---|
| `external-CLI` | External process that already brings its own tool-use loop. | Claude Code, Codex CLI | **v0** |
| `native-provider` | Stateless model endpoint; the tool loop is implemented by acidanthera. | Anthropic, OpenAI, Ollama | Post-v0 |

Both families live behind a single interface, `AgentBackend`. The UI always talks to that interface and doesn't know which engine is behind it.

### 4.3 Central contract — `AgentEvent`
The piece designed from v0 (even though native-providers arrive later). Each backend translates its native stream into this common vocabulary via an **adapter**. The agent panel consumes **only** `AgentEvent` and never touches any engine's raw JSON.

> **Adapters are the system's growth point.** Over time more are added to support more engines and models; the result (`AgentEvent`) is always the same. Adding an engine = writing an adapter, **never** touching the UI.

**Events (v0):**

| Event | UI trigger | Notes |
|---|---|---|
| `agent_message` | Agent text bubble | **Complete** text (reasoning mixed in front). Carries `messageId` for the future evolution to deltas. |
| `tool_call_start` | Chip with spinner | Unique `callId`, `toolName`, normalized `args`. |
| `tool_call_result` | Chip → check or error | Same `callId` as its start (pairs parallel tools). `status: ok\|error` does not tear down the turn. |
| `permission_request` | (unused in v0) | Defined for v2's per-action approval. |
| `turn_done` | Removes "thinking", re-enables input | Optional closing metadata. |
| `error` | Turn failed | Distinct from a `tool_call_result` with error: this **tears down** the turn. |

**Common metadata:** every event carries `timestamp` and `source` (`claude-code` \| `codex`). `source` is for logs/debug, **not** for branching the UI.

**v0 decisions:**
- Text: **complete message**, not deltas. Deltas = future evolution (`messageId` already leaves the door open).
- Reasoning: **mixed** into the normal text (no separate event).

> The type contract lives in `agent-event.ts`.

> **UI binding.** Each event renders through a design-system component — `agent_message`→`ChatMessage` (`streaming` caret reserved for the future delta evolution), `tool_call_start`→`ToolChip status="running"`, `tool_call_result`→`ToolChip status="done"`, `turn_done` clears the caret / re-enables `ChatInput`, `error` renders an inline error row. Full table in §5.6. **Gap to close:** the reference `ToolChip` models only `running|done`; add an `error` status so a `tool_call_result` with `status: error` is shown *without* tearing down the turn (per the table above, an errored tool result must not end the turn — only an `error` event does).

### 4.4 external-CLI integration (headless mode)
The two v0 agents are integrated via their structured headless mode, **not** by embedding a raw terminal. The `cwd` points to the vault. Both expose an event stream over stdout that the adapter translates to `AgentEvent`.

```bash
# Claude Code
claude -p --output-format stream-json \
  --input-format stream-json --verbose \
  --allowedTools "Read,Write,Edit,Glob,Grep"

# Codex CLI (equivalent)
codex exec --json "<prompt>"
```

- **Bidirectional communication:** user turns via stdin, events via stdout. Multi-turn without relaunching the binary (Claude Code: NDJSON per turn; Codex: resumable sessions).
- **Permissions:** both headless modes don't ask for interactive confirmation and fail on an approval request unless auto-approving. v0 scopes the tool set to the vault (`--allowedTools` in Claude Code; policies / `--full-auto` in Codex).
- **Vault context:** the project instructions file is loaded (`CLAUDE.md` / `AGENTS.md`). Don't use modes that skip it (e.g. `--bare`).

The mapping between the two is nearly 1:1; the event names differ (Claude Code: `tool_use`/`tool_result`; Codex: `thread.started`/`item.*`/`turn.completed`). **The adapters (phase 2/3) are resolved during implementation**, by capturing each CLI's real stream.

### 4.5 Editor ↔ agent synchronization
The agent and the editor can touch the same file. **v0 decision:** the agent is a **producer** of notes, not a co-editor of the active document. It writes new notes that appear in the sidebar via the file-watcher; they're opened when wanted. Co-editing the open file is out of initial scope.

- v1: file-watching with reload ("the agent modified this, reload?").
- Discarded: CRDT / real concurrent editing — overkill for a single user.

---

## 5. Features

### 5.0 Layout — Obsidian-style
Three-region structure, left to right:

- **Sidebar (left):** the vault explorer, and — since ADR 0121 — the host of *every* global control. It never unmounts: collapsing it yields a 40px **sidebar rail**, not a hidden region. Above the tree sit the brand row and the **primary nav** (`New note`, `New folder`, `Agent`), each row carrying its chord as a persistent unboxed `Kbd`; below it the **footer identity block** carries the vault name, its recursive note count, and Settings. Because that footer is hidden at 40px, the rail pins its own Settings control beneath the expand toggle, find, the two create buttons, the Agent `✦`, and one glyph per root entry.
- **Central viewer:** the open file, shown through one of two surfaces — the markdown editor or the **read view** (§5.1). The widest region.
- **Agent panel (right):** an **invocable** panel in split view — when opened, the viewer shrinks and both stay visible side by side (not an overlay).
- **Chrome strip (top):** the 40px band the native traffic lights sit on. It is deliberately **not** a component — the sidebar renders its own bare drag strip and `EditorTabs` is the viewer's, so nothing has to track the sidebar's width to keep the seam aligned through expand and collapse (ADR 0121). It carries **no state**, and the only controls it may carry are those that act on *what the window is currently showing* (ADR 0123, amending ADR 0121): today the navigation-history back/forward pair on the sidebar's strip and the **view toggle** (§5.1) on the viewer's, and nothing else. App-level controls — a settings gear, a theme toggle, a create action — stay in the sidebar, which is what keeps the strip from drifting back into a titlebar one convenience at a time. **There is no titlebar.**

The viewer and the agent panel each render as an **inset card**: a `--radius-panel` card of `--bg-canvas` set into a `--bg-panel` gutter that runs continuously from the sidebar, so sidebar and chrome read as one surface. The card is bounded by a **hairline in both themes, never a shadow** — it is inset into the ground rather than elevated above it — and that hairline steps to `--border-strong` while its region is focused, which is how a focused region reads now that no edge is shared. Editor tabs sit detached above the card as `--radius-tab` chips.

The AI entry point is the primary nav's **Agent** row, whose `✦` is one of the sanctioned places the AI accent appears (§5.6). The agent panel is a region with open/closed state within the focus state machine (§3.4). The graph is no longer a permanent panel (§5.4).

### 5.1 Markdown editor / viewer
It starts **directly on CodeMirror 6** (`@uiw/react-codemirror`), not on `@uiw/react-md-editor`: since vim is a pillar from v0 and react-md-editor doesn't run on CM6, starting on the final target is cheaper than migrating. Accepted cost: building preview/toolbar by hand — and the **preview half is now built**, as the *read view* below. The **toolbar half remains unbuilt**.

- `@uiw/react-codemirror` accepts an `extensions` array of CM6 as a prop → that's where `vim()`, the `Ctrl-w` keybinding and `lang-markdown` go.
- `@replit/codemirror-vim` API (v6.x): `vim()` goes first; `getCM(view)` gives access to the legacy API; `Vim.defineEx` registers ex-commands; the `vim-mode-change` event feeds the mode indicator.
- **Two buffer views.** Every open note carries a `view` of `'edit'` or `'read'` beside its vim submode — session state, never persisted, so two open notes can sit in different views. A note **opens in read**; one the app just created (a new note, or today's daily note) opens in edit, because you made it in order to write in it. Both surfaces stay **mounted** side by side inside one buffer pane, the inactive one hidden rather than unmounted, so a toggle costs neither the editor's undo history and cursor nor either side's scroll position. A config buffer (`settings.toml`, `keymaps.toml`) is edit-only.
- **Toggling** is the monochrome `Read`/`Edit` control at the right of the viewer's chrome strip (§5.0) — drawn only for a vault note, hidden for a config buffer — or `Ctrl-w` `e` (`global.toggle-view`). That control is also the read view's only mode indicator, which is why the status cluster carries none; in read the cluster swaps its `ln`/`col` readout for `N words · N min read`.
- **The read view renders the in-memory buffer**, dirty edits included, so toggling previews what was just typed rather than re-reading disk. It renders and does **not** write, with exactly one exception: ticking a `- [ ]` checkbox rewrites that one marker through the normal buffer and save lifecycle — no autosave, no second save path, no direct disk write.
- **Rendering goes through the editor's own parser** (ADR 0125). A hand-written walker turns the `@lezer/markdown` tree that `@codemirror/lang-markdown` already builds into React elements — not `react-markdown`, not a `marked`/DOMPurify pair. One parser **object** serves both views, so edit and read cannot disagree about what a heading is, and GFM (tables, task lists, strikethrough) is one shared configuration rather than two. Because the walker emits elements and **never an HTML string**, raw HTML in a note renders as escaped text: there is no sanitizer anywhere and no injection surface, in an app where an agent writes the notes. Code blocks carry the editor's own palette via `@lezer/highlight`; **inner-language highlighting stays deferred**, so a fenced block whose language has no Lezer parser in the tree renders as plain mono.
- Above the body sits the **note header block**: an inert breadcrumb, the filename stem as the title (a leading `# H1` in the body is suppressed, so the note is not named twice), and one meta line reading `edited <relative> · N links · N min read`. All three are computed from data already in memory, and a segment whose data is missing is omitted rather than placeholdered.
- Monochrome aesthetic driven by the **acidanthera Design System** (§5.6): the CodeMirror 6 theme reads the same CSS variables as the rest of the app (surfaces, the four text tiers, and the mono face for source), so editor and chrome stay visually identical. UI chrome uses Geist, and the read view sets rendered prose in sans on a ~680px measure (§5.6). Inline `[[wikilinks]]` are **ember and navigable** when the target resolves, and **muted and struck through** when it is missing or ambiguous — the same three states in *both* views (§5.6, ADR 0126).

### 5.2 Agent panel (invocable)
- Opens/closes from the primary nav's **Agent** row (§5.0) or `Ctrl-w c`; split view next to the viewer.
- Spawns the selected `AgentBackend`. v0: selector between Claude Code and Codex CLI.
- Renders the `AgentEvent` stream as native UI (transcript + tool-call chips), not a terminal — via the design system's `ai/*` components: `ChatMessage`, `ToolChip`, and `ChatInput` (§5.6). The event → component mapping is in §5.6.
- Input for user turns; backend selector.

> The rename to *agent* covers the **region and panel only**. The transcript and its persistence stay `chat`: `useChatStore`, `ChatFile`, `.acidanthera/chats/`, the `global.toggle-chat` command id, and the `chat.history` keymap layer all keep the old name, so no `keymaps.toml` breaks and no vault needs migrating.

### 5.3 File sidebar
Collapsible folder-and-file explorer of the vault, refreshed via the file-watcher whenever the agent (or the user) writes or modifies files. Rows use the design system's `FileTreeItem` (§5.6).

A **note row** is two lines — its title, then `edited <relative>` in muted mono metadata. A **directory row** is one muted line whose trailing number counts the notes beneath it at any depth. The asymmetry is what makes a folder read as a subdued group header inside what is still a tree rather than a two-level grouped list. A note whose mtime cannot be read renders **no** meta line rather than a placeholder, and an inline name input occupies the full two-line height with its meta line blank, so naming or renaming a note never shifts the list. The folder count is hidden from the row's accessible name — it only summarizes child rows the tree already enumerates — while the edited time is not, existing nowhere else.

`FileTreeItem` also encodes the two vim selection states from §3.4: `active` (the open file — `--bg-elevated` with primary text) and `cursor` (the vim keyboard cursor — `--bg-hover` with secondary text). An unchanged row is transparent and moves to `--bg-hover` on pointer hover.

### 5.4 Neural tree / Graph view (invocable view, post-v0)
A view that opens (not a permanent panel, Obsidian-style). Nodes = files, edges = links between notes.

- New piece: **link parser + in-memory index**. Parses the `.md` files, extracts `[[wikilinks]]` and markdown links, builds the graph. Lives next to the file-watcher: on a change, it reindexes and updates.
- **Render: cosmos** (GPU rendering), chosen for scaling to large vaults over a naive d3-force.

### 5.5 Keyboard-first / vim keys
- The whole app usable with the keyboard only (§3.4), including opening/closing the agent panel.
- Toggle: vim starts **enabled by default** in v0. The toggle (and other preferences) will live in a future settings modal; v0 doesn't build that UI yet.

### 5.6 Design system & styling

acidanthera's visual layer is the **acidanthera Design System**, from Claude Design project `d333dc32-6b35-4f89-9982-66bbc1014fcb`, delivered with **Tailwind CSS v4**. The former project `ff2532ab-4501-47c9-8acd-a36fe9719a84` is superseded. Token values live in `src/styles/tokens/` and are exposed to Tailwind through `src/styles/index.css`.

#### Tokens and themes

- **Surfaces:** the five-step ladder is `--bg-canvas` (`#0b0c0d`) → `--bg-panel` → `--bg-surface` → `--bg-elevated` → `--bg-hover`. The editor canvas is deliberately darker than the sidebar panel; this contrast is load-bearing.
- **Text:** `--text-primary`, `--text-body`, `--text-secondary`, and `--text-muted`. `--text-body` is editor prose specifically; primary is for headings and active rows.
- **Borders:** `--border-hairline` for seams and dividers, `--border` for controls and cards, and `--border-strong` for focused outlines and modal edges.
- **Accent:** ember is `#e8683a` in dark and `#f54e00` in light. It means *the AI acted here* — **or** *this navigates into the vault*; see ADRs 0105 and 0126. Its sanctioned uses are the primary nav's **Agent** `✦` and agent-turn glyphs, Send, the active model pill, a running tool chip, the dirty-note dot, and a `[[wikilink]]` whose target **resolves** — plus, at disabled opacity, an AI action that is offered but not yet available. The wikilink clause is the accent's one genuine widening (ADR 0126): a rendered note whose links are indistinguishable from its prose loses the one affordance the read view exists to present. It is kept narrow by the boundary that comes with it — a link that is **missing or ambiguous** gets no ember at all, rendering muted and struck through, and the ember is identical in *both* views, because the same link changing color under a toggle would be worse than either color alone. **The brand mark is the exception:** it is identity rather than signal, so the accent system does not apply to it at all and its ember ring renders wherever the mark renders — app icon, favicon, sidebar brand row, footer identity tile, and the collapsed rail (ADR 0122, superseding ADR 0117). The exemption covers the mark, never a fill behind it: the footer tile is `--bg-elevated`, never `--accent-soft`. `--danger` is the app's only other colored fill and marks the destructive path (ADRs 0113, 0116). Diff colors retain their separate directional meaning.
- **Typography:** Geist is the UI-chrome face. The content rule is **mono is for source, sans is for rendered prose**: JetBrains Mono carries the editor, code blocks (at the `--font-mono` token, never `settings.editorFont`), inline code, and all metadata, while the read view sets rendered prose in sans on a shared ~680px measure. Headings stop at weight 500 in both views; 600 is reserved for strong inline emphasis. The semantic type scale lives in `typography.css`.
- **Radii:** the eight-step semantic ladder is `--radius-kbd`, `--radius-btn`, `--radius-item`, `--radius-tab`, `--radius-card`, `--radius-panel`, `--radius-modal`, and `--radius-pill`, named for what each token wraps.
- **Themes:** dark midnight and light parchment are keyed by `data-theme` and applied by `useApplyTheme`; there is no container theme class.

#### Geometry, elevation, and iconography

- **Rails:** sidebar 224px (`--rail-sidebar`) · collapsed rail 40px (`--rail-sidebar-collapsed`) · agent panel 340px (`--rail-agent`) · chrome strip 40px (`--rail-titlebar`, which keeps its name having outlived the component it was named for — ADR 0121). There is no status bar **and no titlebar** (ADRs 0107, 0121): editor state renders in the editor's bottom-right status cluster, and every global control lives in the sidebar — in the primary nav, the brand row, the footer identity block, or, while collapsed, the rail.
- **Elevation:** dark mode uses hairline borders rather than shadows, except window and overlay drops. Light mode uses warm shadows only, never cool-tinted shadows. The scrim is `rgba(5,6,7,.55)` with no backdrop blur. An **inset card** (§5.0) is bounded by a hairline in *both* themes and never a shadow: it is set into the ground, not raised above it.
- **Motion:** short 150ms fades, no bounce; hover moves one surface step up.
- **Glyphs:** `✦` AI · `◈` context/file · `⌕` search · `＋` add · `·` separator. These are **characters that live inside text** — chip prefixes, section-label marks, message glyphs — not an icon set; they are typography and they stay characters.
- **Icons:** every *drawn* icon comes from Lucide through the `Icon` primitive, which is the only place the house spec is set — `strokeWidth={1.2}` with `absoluteStrokeWidth`, so the stroke reads 1.2px at any size, over Lucide's matching `currentColor`, no fill, and round caps and joins (ADR 0115). `AcidantheraMarkGlyph` is the single hand-drawn SVG that survives, because a brand mark is not an icon and no library ships it. Disclosure (`▸`/`▾`) is a rotated Lucide chevron, not a character.

#### Component inventory

`src/components/ui/` contains the store-free presentational primitives `Button`, `Kbd`, `SectionLabel`, `Chip`, `Switch`, `Segmented`, `Modal`, `Icon`, and `Tooltip`. `Button` has `primary`, `danger`, `secondary`, and `ghost` variants; the two filled variants are the app's only colored buttons — `primary` is reserved for AI actions and `danger` for the confirming click of a destructive dialog, and they never appear together. `Chip` is the only label-shaped primitive: the square label chip it replaced was deleted once it had no consumer, so a bordered mono label box is no longer part of the vocabulary. `Modal` is the one primitive with a side effect — it registers the modal keymap layer. `Tooltip` is the sidebar's app-drawn hover reveal and takes a `ReactNode`, so anything store-derived is resolved by its caller. `FileTreeItem` and `EditorTabs` deliberately remain store-aware application components rather than design primitives. The layout, editor, vault, overlay, and AI components compose these rules but are not promoted to generic primitives.

One more rule a reviewer needs: the **primary nav** is the single surface in the app that renders a chord *persistently*, as an unboxed `Kbd` in the row rather than on hover. Every user-facing chord — there and everywhere else — is read from the resolved keymap, never written as a string literal.

For implementation and review guidance, use the vendored `acidanthera-design` skill. ADRs 0104–0106 record the token-vocabulary, AI-accent, and app-drawn-chrome decisions; ADR 0107 retires the status bar, ADR 0115 replaces the hand-drawn icons with Lucide, and ADRs 0121–0122 dissolve the titlebar into per-region chrome strips and exempt the brand mark from the accent system.

---

## 6. Workflow

The full loop, in a single window:

1. You ask the agent something from the agent panel (e.g. "write a brief on X reading my notes on Y").
2. The agent reads vault notes (Read/Grep/Glob) and writes a new brief as `.md`.
3. The file-watcher detects the change: the brief appears in the sidebar (and in the graph) with no intervention.
4. You open it in the editor and manually distill it into atomic notes (the personal judgment step).
5. The links created while distilling are reflected in the neural tree.

**Result:** zero copy-paste, zero context-switch between windows.

---

## 7. Roadmap

### First — App-level vim focus system
The navigation state machine (active region + global mode + chat state) and the CodeMirror coexistence rule are built before everything else: they age badly if patched later.

### Half A — Editor + Filesystem
- Tauri + React + Vite scaffold.
- **Styling foundation (§5.6):** add Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui + the `@/` alias + `cn()`; vendor the acidanthera design tokens; self-host JetBrains Mono; wire the CM6 theme to the same CSS variables. Remove the default template's light/dark CSS (acidanthera is dark-only).
- CodeMirror 6 editor with vim. Open vault, sidebar, open/edit/save `.md`.
- File-watcher (`notify`) that refreshes the sidebar.

### Half B — Agent
- Define the `AgentEvent` contract (done — `agent-event.ts`).
- Two external-CLI `AgentBackend`s: Claude Code (stream-json) and Codex CLI (`--json`), each with its adapter (capture real streams + map).
- Spawn from Rust; chat panel that renders the stream; backend selector.

### v0 integration
The agent writes to the vault → it appears in the sidebar. Full loop, one window.

### Post-v0 (in order of interest)
- Graph view / neural tree (link parser + cosmos).
- Native-provider backends (Level 2): in-house tool loop against APIs (Anthropic, OpenAI, Ollama) behind the same `AgentBackend` interface.
- Streaming via deltas.
- Per-action permission approval from the UI.

---

## 8. Decision log

> Historical record: each row states the decision **as it was taken**, not the system as it stands
> today. Where a row and a live section disagree, the live section wins — §5.6 supersedes the
> design-system, typeface, and accent rows, and §5.0 supersedes the layout row.

| Topic | Decision | Status |
|---|---|---|
| Name | acidanthera | ✅ |
| Base editor | CodeMirror 6 directly (not react-md-editor) | ✅ |
| Layout | Obsidian-style: sidebar + viewer + invocable chat with FAB | ✅ |
| Vim navigation | Two levels (editor / app), `Ctrl-w` as exit prefix | ✅ |
| Authentication and sync | v0 with no auth or sync; credentials inherited from the CLIs | ✅ |
| Agnosticism | Level 1 in v0 (agent-agnostic); Level 2/3 post-v0 | ✅ |
| Event contract | Normalized `AgentEvent`; adapters as the extension point | ✅ |
| Agent text | Complete message in v0; deltas as evolution | ✅ |
| Graph render | cosmos (GPU) | ✅ |
| Styling stack | Tailwind CSS v4 (CSS-first) + shadcn/ui primitives, token-skinned | ✅ |
| Design system | acidanthera tokens from Claude Design project `ff2532…`; monochrome, one lime accent | ✅ |
| Typeface | JetBrains Mono (self-hosted); Berkeley Mono documented swap-in | ✅ |
| Accent discipline | Lime reserved for the active FAB only; shadcn `--primary`/`--ring` stay monochrome | ✅ |
| Dark-only theme | Near-black always; no light theme / `prefers-color-scheme` branch in v0 | ✅ |
| ToolChip error state | Extend reference `ToolChip` (`running\|done`) with `error` for tool-result errors | 🔧 Implementation |
| Global keymap | Approach validated in scaffold; built first | ✅ |
| Vim toggle | Enabled by default; settings deferred | ✅ |
| Headless event schemas | One adapter per engine; map against real streams | 🔧 Implementation |

**Legend:** ✅ resolved · 🔧 resolved during implementation
