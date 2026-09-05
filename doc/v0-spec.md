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
- File sidebar + central viewer + invocable AI chat.
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
- **(b) App-level global vim** → navigating without a mouse between the layout regions (sidebar, viewer, chat when open). **Not a lib**: it's a custom focus-management + global keymap system (state machine: one active region, one global mode, plus the chat's open/closed state). It's the most custom piece of the project and is built **first**; the regions hang off it.

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
The piece designed from v0 (even though native-providers arrive later). Each backend translates its native stream into this common vocabulary via an **adapter**. The chat panel consumes **only** `AgentEvent` and never touches any engine's raw JSON.

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

- **Sidebar (left):** collapsible folder-and-file explorer of the vault.
- **Central viewer:** the open file (markdown editor). The widest region.
- **AI chat (right):** an **invocable** panel in split view — when opened, the viewer shrinks and both stay visible side by side (not an overlay). Separated by a thin divider.
- **Floating AI button (FAB):** top-right corner, opens/closes the chat. Implemented as the design system's `AiFab`; its ember glyph is one of the sanctioned places the AI accent appears (§5.6), alongside the send button, active model pill, running tool chip, agent-turn glyph, and dirty-note dot. The chat panel carries **no header chrome** — no rule, no title — so the FAB floats over its top row beside the model pill.

The chat is a region with open/closed state within the focus state machine (§3.4). The graph is no longer a permanent panel (§5.4).

### 5.1 Markdown editor / viewer
It starts **directly on CodeMirror 6** (`@uiw/react-codemirror`), not on `@uiw/react-md-editor`: since vim is a pillar from v0 and react-md-editor doesn't run on CM6, starting on the final target is cheaper than migrating. Accepted cost: building preview/toolbar by hand.

- `@uiw/react-codemirror` accepts an `extensions` array of CM6 as a prop → that's where `vim()`, the `Ctrl-w` keybinding and `lang-markdown` go.
- `@replit/codemirror-vim` API (v6.x): `vim()` goes first; `getCM(view)` gives access to the legacy API; `Vim.defineEx` registers ex-commands; the `vim-mode-change` event feeds the mode indicator.
- Monochrome aesthetic driven by the **acidanthera Design System** (§5.6): the CodeMirror 6 theme reads the same CSS variables as the rest of the app (surfaces, the four text tiers, and JetBrains Mono for content), so editor and chrome stay visually identical. UI chrome uses Geist. Preview/toolbar are built by hand with Tailwind + shadcn primitives; inline `[[wikilinks]]` render via the `Wikilink` component (underline + hover, no color).

### 5.2 AI chat (invocable panel)
- Opens/closes with the FAB or a keyboard shortcut; split view next to the viewer.
- Spawns the selected `AgentBackend`. v0: selector between Claude Code and Codex CLI.
- Renders the `AgentEvent` stream as native UI (chat + tool-call chips), not a terminal — via the design system's `ai/*` components: `ChatMessage`, `ToolChip`, and `ChatInput`, with the `AiFab` toggle (§5.6). The event → component mapping is in §5.6.
- Input for user turns; backend selector.

### 5.3 File sidebar
Collapsible folder-and-file explorer of the vault, refreshed via the file-watcher whenever the agent (or the user) writes or modifies files. Rows use the design system's `FileTreeItem` (§5.6), which encodes the two vim selection states from §3.4: `active` (the open file — `--bg-elevated` with primary text) and `cursor` (the vim keyboard cursor — `--bg-hover` with secondary text). An unchanged row is transparent and moves to `--bg-hover` on pointer hover.

### 5.4 Neural tree / Graph view (invocable view, post-v0)
A view that opens (not a permanent panel, Obsidian-style). Nodes = files, edges = links between notes.

- New piece: **link parser + in-memory index**. Parses the `.md` files, extracts `[[wikilinks]]` and markdown links, builds the graph. Lives next to the file-watcher: on a change, it reindexes and updates.
- **Render: cosmos** (GPU rendering), chosen for scaling to large vaults over a naive d3-force.

### 5.5 Keyboard-first / vim keys
- The whole app usable with the keyboard only (§3.4), including opening/closing the chat.
- Toggle: vim starts **enabled by default** in v0. The toggle (and other preferences) will live in a future settings modal; v0 doesn't build that UI yet.

### 5.6 Design system & styling

acidanthera's visual layer is the **acidanthera Design System**, from Claude Design project `d333dc32-6b35-4f89-9982-66bbc1014fcb`, delivered with **Tailwind CSS v4**. The former project `ff2532ab-4501-47c9-8acd-a36fe9719a84` is superseded. Token values live in `src/styles/tokens/` and are exposed to Tailwind through `src/styles/index.css`.

#### Tokens and themes

- **Surfaces:** the five-step ladder is `--bg-canvas` (`#0b0c0d`) → `--bg-panel` → `--bg-surface` → `--bg-elevated` → `--bg-hover`. The editor canvas is deliberately darker than the sidebar panel; this contrast is load-bearing.
- **Text:** `--text-primary`, `--text-body`, `--text-secondary`, and `--text-muted`. `--text-body` is editor prose specifically; primary is for headings and active rows.
- **Borders:** `--border-hairline` for seams and dividers, `--border` for controls and cards, and `--border-strong` for focused outlines and modal edges.
- **Accent:** ember is `#e8683a` in dark and `#f54e00` in light. It means *the AI acted here* and nothing else; see ADR 0007. Its sanctioned uses are the FAB and agent-turn glyphs, Send, the active model pill, a running tool chip, and the dirty-note dot. Diff colors retain their separate directional meaning.
- **Typography:** Geist is the UI-chrome face; JetBrains Mono is for content and metadata. Headings stop at weight 500; 600 is reserved for strong inline emphasis. The semantic type scale lives in `typography.css`.
- **Radii:** the eight-step semantic ladder is `--radius-kbd`, `--radius-btn`, `--radius-item`, `--radius-tab`, `--radius-card`, `--radius-panel`, `--radius-modal`, and `--radius-pill`, named for what each token wraps.
- **Themes:** dark midnight and light parchment are keyed by `data-theme` and applied by `useApplyTheme`; there is no container theme class.

#### Geometry, elevation, and iconography

- **Rails:** sidebar 224px · chat 340px · titlebar 40px · FAB 40px. There is no status bar: editor state renders in the editor's bottom-right status cluster, while the titlebar hosts the sidebar re-show, find, and settings controls.
- **Elevation:** dark mode uses hairline borders rather than shadows, except window and overlay drops. Light mode uses warm shadows only, never cool-tinted shadows. The scrim is `rgba(5,6,7,.55)` with no backdrop blur.
- **Motion:** short 150ms fades, no bounce; hover moves one surface step up.
- **Glyphs:** `✦` AI · `◈` context/file · `⌕` search · `▸`/`▾` disclosure · `＋` add · `·` separator. Unicode glyphs are first-class icons. Drawn icons are hand-tuned at 15px on a 16 viewBox with a 1.2 stroke and `currentColor`; do not add an icon dependency.

#### Component inventory

`src/components/ui/` contains the five store-free primitives: `Kbd`, `SectionLabel`, `Chip`, `Switch`, and `Segmented`, plus `Button` and `Badge`. `Button` has `primary`, `secondary`, and `ghost` variants; `primary` is reserved for AI actions. `FileTreeItem` and `EditorTabs` deliberately remain store-aware application components rather than design primitives. The layout, editor, vault, overlay, and AI components compose these rules but are not promoted to generic primitives.

For implementation and review guidance, use the vendored `acidanthera-design` skill. ADRs 0006–0008 record the token-vocabulary, AI-accent, and titlebar decisions.

---

## 6. Workflow

The full loop, in a single window:

1. You ask the agent something from the chat (e.g. "write a brief on X reading my notes on Y").
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
