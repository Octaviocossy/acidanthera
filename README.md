<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/acidanthera-lockup-dark.png">
    <img src="assets/brand/acidanthera-lockup-light.png" width="420" alt="acidanthera">
  </picture>
  <p><strong>A local-first, vim-first markdown notes app with a coding agent living inside it.</strong></p>
  <p>
    <a href="https://github.com/Octaviocossy/acidanthera/actions/workflows/ci.yml"><img src="https://github.com/Octaviocossy/acidanthera/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="Platform: macOS" />
  </p>
</div>

<!-- TODO: add a screenshot of the three-region layout here -->

## Why acidanthera

Notes live in one window. The agent lives in a terminal in another. The work is the
context-switch between them.

acidanthera collapses that into a single window: a real vim-mode markdown editor on the left, an
agent panel on the right, both pointed at the same folder of `.md` files.

Everything it stands on is deliberately boring:

- **Your notes are plain markdown** in a folder you chose. Nothing is in a database, and the
  app coexists with an existing Obsidian vault rather than importing it.
- **No account, no server, no sync, no API key.** The agent runs as a child process of the
  CLI you have already logged into, and acidanthera never sees a credential.
- **Config is files.** `settings.toml` and `keymaps.toml` are the source of truth; the
  Settings dialog is just a typed editor of them.

## Features

**Vault**
Opens any folder of markdown (Obsidian-compatible). A filesystem watcher keeps the tree live,
so a note the agent writes shows up without a refresh. Create notes and folders inline with
`a` / `A`. Every filesystem operation is root-guarded and rejects symlink escapes.

**Editor**
CodeMirror 6 with vim emulation on by default. Multi-buffer tabs that preserve undo history
and cursor position across switches. `[[wikilink]]` decoration, markdown syntax highlighting,
a live line:col and vim-submode readout, and dirty-close confirmation. `yy`, `y{motion}`, and
visual-line `y` write to the vim register **and** the system clipboard.

**Agent**
A chat panel that renders agent output as native UI — message bubbles, tool chips, a thinking
indicator — not a terminal emulator. Claude Code and Codex sit behind one `AgentBackend`
interface, so the model you pick determines the engine. Conversations autosave as readable
markdown under `<vault>/.acidanthera/chats/`, and a saved thread can be reopened and continued.

**Keyboard-first**
One window-level dispatcher resolves every key. `Ctrl-w`-prefixed chords move between regions,
a Spotlight-style fuzzy finder opens any note, and every app-level binding is rebindable.

## Requirements

| | |
|---|---|
| **OS** | macOS. See [Platform support](#platform-support). |
| **Node** | ≥ 18 (required by Vite 7 / React 19) |
| **pnpm** | 10+ |
| **Rust** | stable toolchain, plus the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) |
| **Agent CLI** | [`claude`](https://claude.com/claude-code) and/or [`codex`](https://github.com/openai/codex), installed and logged in — optional, needed only for the chat panel |

### Platform support

acidanthera is macOS-only today. It draws its own title bar, which relies on the macOS-only
`titleBarStyle: "Overlay"` window option, and the component is not yet gated on platform — so
on Windows and Linux the app builds and runs but shows a doubled title bar. This is a known,
deliberate trade-off recorded in [ADR 0008](.agents/adr/0008-custom-titlebar-macos-only.md);
gating the component (rather than deleting it) is the path to a cross-platform build.

## Install

There are no prebuilt releases yet — build from source:

```bash
git clone https://github.com/Octaviocossy/acidanthera.git
cd acidanthera
pnpm install

pnpm tauri dev      # run in development
pnpm tauri build    # bundle into src-tauri/target/release/bundle/
```

## Quick start

1. **First launch** creates and opens `~/Documents/acidanthera-brain`. Point it somewhere else in
   Settings (`Ctrl-w s`) → Vault → Change…, or at an existing Obsidian vault.
2. **Opening a vault scaffolds `AGENTS.md` and `CLAUDE.md`** into its root, hidden from the
   sidebar. This is how the agent knows it is writing wikilinked notes into your vault rather
   than co-editing the file you have open.
3. **Write something.** `a` in the sidebar names a new note, `Ctrl-w f` opens the fuzzy finder,
   and `:w` or `Cmd-S` saves.
4. **Talk to the agent.** `Ctrl-w c` opens the chat panel; pick a model from the pill in the
   input.

> [!IMPORTANT]
> The default model is **GPT 5.4 mini**, which runs on the `codex` engine. If you only have
> Claude Code installed, switch to **Sonnet 5** or **Haiku 4.5** before your first message —
> otherwise the turn fails with a `CommandNotFound` error naming the missing binary.

## Keybindings

A single window-level dispatcher resolves every keystroke, walking layers in a fixed order —
**editor → active region → global** — where the first match wins with no fallthrough. A chord
sequence like `Ctrl-w` `f` arms a 1.5 s window for its next step; any other key, a timeout, or
the owning layer going inactive silently cancels it.

**Global** — works anywhere focus is not inside a text field.

| Keys | Command | Action |
|---|---|---|
| `Ctrl-w` `f` | `global.find-file` | Open the file finder |
| `Ctrl-w` `h` / `l` | `global.focus-previous` / `-next` | Cycle regions (sidebar → viewer → chat, wraps) |
| `Ctrl-w` `b` | `global.toggle-sidebar` | Expand or collapse the sidebar |
| `Ctrl-w` `c` | `global.toggle-chat` | Toggle the chat panel |
| `Ctrl-w` `s` | `global.toggle-settings` | Toggle the settings dialog |
| `:` | `global.command-mode` | Open the command bar |

**Sidebar** — when focused.

| Keys | Command | Action |
|---|---|---|
| `j` / `k` | `sidebar.cursor-down` / `-up` | Move the cursor |
| `l` / `Enter` | `sidebar.open` | Expand a directory, or open a file and focus the editor |
| `h` | `sidebar.collapse` | Collapse an expanded directory |
| `a` | `sidebar.new-note` | Name a new note |
| `A` | `sidebar.new-directory` | Name a new folder |

**Chat History tab** — when the chat is focused and History is showing.

| Keys | Command | Action |
|---|---|---|
| `j` / `k` | `chat.history.cursor-down` / `-up` | Move the cursor |
| `l` / `Enter` | `chat.history.open` | Load that conversation into the transcript |

**Editor**

| Keys | Action |
|---|---|
| `:w` / `Cmd-S` | Save (`Cmd` on macOS, `Ctrl` elsewhere) |
| `yy` / `y{motion}` / `V` `y` | Yank to the vim register **and** the system clipboard |
| everything else | Standard [`@replit/codemirror-vim`](https://github.com/replit/codemirror-vim) |

Three sets of keys are **not** rebindable: the file finder's own `↑` `↓` `Enter` `Escape`,
`Escape` to leave command mode, and the `:w` ex-command.

Full reference, including precedence details and the vim coexistence rule:
[`doc/keybindings.md`](doc/keybindings.md).

## Configuration

Both config files live in the platform app-config directory — on macOS:

```
~/Library/Application Support/com.ovct.acidanthera/
```

They hot-reload on save, and both are openable inside acidanthera from the file finder (`Ctrl-w f`).

### `settings.toml`

Flat, camelCase, four keys:

| Key | Type | Default | Accepted values |
|---|---|---|---|
| `model` | string | `"gpt-5.4-mini"` | `gpt-5.4-mini`, `haiku-4.5`, `sonnet-5`, `gpt-5.5-fast` |
| `editorFont` | string | `"JetBrains Mono"` | any installed font family name |
| `theme` | string | `"dark"` | `"dark"` or `"light"` |
| `vaultPath` | string | `~/Documents/acidanthera-brain` | absolute path to a directory |

An invalid *value* degrades that key alone — it falls back to the default and reports a
diagnostic, leaving the rest of the file in effect. Only a genuine TOML *syntax* error rejects
the whole document, and while one is present the Settings dialog refuses to write. Writes from
the dialog edit only the keys that changed, preserving your comments and key order.

### `keymaps.toml`

Command-keyed, not chord-keyed. The file ships fully commented out with one line per command,
each showing its live default — uncomment and edit to rebind:

```toml
"global.find-file"   = ["ctrl-w f"]   # an override replaces the default array wholesale
"sidebar.new-note"   = ["n", "a"]     # a command may have several chords
"global.toggle-chat" = []             # an empty array unbinds the command entirely
```

Chord notation follows CodeMirror's: spaces separate the steps of a sequence, hyphens separate
modifiers from the base key. Modifiers are `ctrl`, `alt`, `shift`, `meta`, and `mod` (Cmd on
macOS, Ctrl elsewhere).

Every degradation is reported rather than swallowed: an unknown command id, an unparseable
chord, or a chord claimed twice in one layer raises a diagnostic and falls back, without
taking the rest of the file down with it.

## Where your data lives

| Path | Contents |
|---|---|
| `<vault>/**/*.md` | Your notes — plain markdown, the source of truth |
| `<vault>/AGENTS.md`, `<vault>/CLAUDE.md` | Agent instructions, auto-scaffolded, hidden from the sidebar |
| `<vault>/.acidanthera/chats/<id>.chat.md` | Saved conversations — markdown with frontmatter, readable in Obsidian |
| app-config dir | `settings.toml`, `keymaps.toml` |

Nothing else is written anywhere. Deleting `.acidanthera/` loses your chat history and nothing else.

## Project structure

```
src/                      React 19 + TypeScript frontend
├── components/
│   ├── ai/               chat surface — FAB, transcript, input, tool chips, history
│   ├── editor/           CodeMirror buffer view, tabs, dirty-close dialog
│   ├── layout/           app chrome — titlebar, sidebar, viewer, chat panel, dialogs
│   ├── ui/               presentational primitives (button, badge, chip, kbd, …)
│   └── vault/            file-tree rows, entry drafts, glyphs
├── hooks/                app-level effects — keymap, save loop, bootstrap, watchers
├── lib/
│   ├── agent/            engine-agnostic event contract, backend registry, model catalog
│   ├── chat/             chat-file codec and resume-prompt building
│   ├── config/           config-entry catalog and open routing
│   ├── editor/           CodeMirror wiring — vim, highlighting, save, yank, wikilinks
│   ├── keymap/           chord parsing, defaults, resolution, dispatcher
│   └── vault/            vault helpers — search, open, switch, sidebar rows
├── services/             the only callers of @tauri-apps/api
├── stores/               Zustand stores (app, editor, chat, sidebar, settings, …)
└── styles/               Tailwind v4 entry + design tokens

src-tauri/src/            Rust backend
├── lib.rs                Tauri builder — plugins, managed state, 19 commands
├── vault.rs              root-guarded filesystem ops + notify watcher
├── agent.rs              child-process spawn/stream/stdin for the agent CLIs
├── chats.rs              chat persistence under <vault>/.acidanthera/chats/
├── config.rs             allowlisted TOML config files + watcher
├── settings.rs           settings.toml read/write, comment-preserving
└── logging.rs            file + stdout logging
```

Built with Tauri 2, React 19, Vite 7, CodeMirror 6, Tailwind v4, and Zustand. Version tables
live in [`doc/tech-stack.md`](doc/tech-stack.md).

## Development

| Command | Does |
|---|---|
| `pnpm dev` | Vite dev server, frontend only (port 1420) |
| `pnpm tauri dev` | Full desktop app in development |
| `pnpm build` | `tsc` type-check + Vite production build |
| `pnpm tauri build` | Bundle the desktop app |
| `pnpm test` | Vitest, run once |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm coverage` | v8 coverage report |
| `pnpm test:rust` | `cargo test` for the Rust backend |
| `pnpm check` | Biome lint + format check |
| `pnpm check:fix` | Biome lint + format, writing fixes |

Tests are co-located next to what they cover — `foo.ts` beside `foo.test.ts` — with Rust tests
in `#[cfg(test)] mod tests` blocks inside each module. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the full conventions.

## Built with agents

This repository is developed agent-first, and the `.agents/` directory is committed on purpose
— it is the workflow, not scratch space. One canonical set of rules is consumed identically by
Claude Code and OpenCode.

| Directory | Contents |
|---|---|
| `.agents/rules/` | 9 rules the agent must follow — planning, testing, glossary, ADRs, orchestration |
| `.agents/commands/` | 13 cross-agent slash commands, each with a thin wrapper per agent |
| `.agents/skills/` | 5 skills the agent loads on its own when the situation matches |
| `.agents/adr/` | 11 architecture decision records |
| `.agents/ubiquitous-language.md` | The domain glossary — canonical terminology and the invariants the app maintains |

The toolchain is zero-dependency by design: POSIX `sh` and Markdown, nothing to install before
it works. Read [`.agents/docs/workflow.en.md`](.agents/docs/workflow.en.md) for how the pieces
fit together ([Español](.agents/docs/workflow.es.md)).

Product design rationale lives in [`doc/v0-spec.md`](doc/v0-spec.md).

## Roadmap

Not in v0 yet, roughly in order of intent:

- **Graph view** — a link parser feeding a GPU-rendered note graph
- **Native provider backends** — Anthropic, OpenAI, and Ollama with an in-house tool loop, so
  a CLI is no longer required
- **Token-delta streaming** and per-action permission approval (both already have reserved
  slots in the agent event contract)
- **Ex-commands** wired to the `:` command bar, which currently opens and closes without
  running anything
- **Keyboard tab switching** and a delete affordance for saved chats
- **Windows and Linux** support, gated on the titlebar component

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) — it covers local
setup, the checks to run before opening a PR, and the conventions this codebase holds to
(co-located tests, the domain glossary, and the acidanthera design system).

If you are planning something substantial, open an issue first so the design can be settled
before either of us writes code.

## License

[MIT](LICENSE) © Octavio Cossy Torquati
