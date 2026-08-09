# Plan: Open-Source Documentation — README, LICENSE, CONTRIBUTING, CI

> Status: **completed**
> Created: 2026-08-08
> Updated: 2026-08-08

## Context

`README.md` is still the unmodified Tauri scaffold ("Tauri + React + Typescript — This template should
help get you started…") plus a one-row Agent Skills table. Nothing in it describes orbit. The repo is
currently **private** with `licenseInfo: null`, and has **no** `LICENSE`, `CONTRIBUTING.md`,
`SECURITY.md`, `CHANGELOG.md`, or `.github/` directory of any kind — so there is no CI either.

The user is opening this project up and wants standard open-source documentation. Decisions taken in
the interrogation preceding this plan:

| Decision | Chosen |
|---|---|
| Scope | README rewrite **+** LICENSE **+** CONTRIBUTING.md **+** a CI workflow |
| License | **MIT** |
| Positioning | **Full open-source project** — contributions welcome, standard OSS framing |
| Reference depth | Key tables inline (keybindings, `settings.toml`), deep detail linked to `doc/` |
| `.agents/` scaffold | Brief README section + link to `.agents/docs/workflow.en.md` |

Note on the scope answer: three companion files were selected *alongside* the "README only" option.
That combination is self-contradictory, so this plan takes the superset (all four artifacts). If only
the README was actually wanted, drop Steps 2, 3, and 4.

The intended outcome: someone landing on `github.com/Octaviocossy/orbit-111` understands what orbit is
in ten seconds, can build and run it in five minutes, and can find the keybinding or config key they
need without opening the source.

### Honesty constraints the docs must respect

These are real properties of the codebase that the README must not paper over:

1. **macOS-only today.** `tauri.conf.json` sets `titleBarStyle: "Overlay"` + `hiddenTitle: true`
   (macOS-only Tauri options) and `Titlebar.tsx` hardcodes `ml-[78px]` to clear the traffic lights.
   There are **zero** `#[cfg(target_os)]` gates and no frontend platform detection — on Windows/Linux
   the app builds but shows a doubled title bar. ADR 0008 accepts this deliberately.
2. **No prebuilt releases.** Build from source is the only install path.
3. **AI features require external CLIs.** orbit spawns `claude` and/or `codex` as child processes and
   inherits their existing login. It never handles API keys (`doc/v0-spec.md` §3.3). A missing binary
   surfaces as `CommandNotFound`.
4. **The default model's engine may not be installed.** `DEFAULT_MODEL_ID = 'gpt-5.4-mini'` maps to the
   `codex` engine (`src/lib/agent/model-catalog.ts`).
5. **Nothing pins toolchain versions.** No `engines`, `packageManager`, `rust-toolchain.toml`, or
   `.nvmrc`. The "pnpm 10 / Node ≥18" figures exist only as prose in `AGENTS.md`.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `README.md` | Full rewrite — the product front page |
| CREATE | `LICENSE` | MIT, 2026 Octavio Cossy Torquati |
| CREATE | `CONTRIBUTING.md` | Dev setup, the `.agents/` workflow, commit/PR conventions |
| CREATE | `.github/workflows/ci.yml` | Frontend + Rust checks on push/PR |
| MODIFY | `package.json` | Add `description`, `license`, `repository`, `engines`, `packageManager` |
| MODIFY | `src-tauri/Cargo.toml` | Replace scaffold `description = "A Tauri App"` / `authors = ["you"]` |
| MODIFY | `doc/keybindings.md` | Fix the wrong config path (line 7) |
| MODIFY | `doc/tech-stack.md` | Fix stale font package + missing modules/crates |
| CREATE | `.agents/plans/2026-08-08-open-source-documentation.md` | Copy of this plan, per `plan-creation.md` |

## Step-by-Step Implementation

> **Step 0 — Persist this plan into the repo**
>
> - **File:** `.agents/plans/2026-08-08-open-source-documentation.md`
> - **Action:** CREATE
> - **Details:** Copy this plan verbatim. `.agents/rules/plan-creation.md` requires every plan to live
>   in `.agents/plans/`; plan mode could only write to the harness path.
> - **Why:** Keeps the repo's own planning convention intact.

---

> **Step 1 — Rewrite `README.md`**
>
> - **File:** `README.md`
> - **Action:** MODIFY (full replacement)
> - **Why:** It is the only artifact a visitor is guaranteed to read.

Write these sections, in order. Every fact below is verified against the source paths cited.

**1.1 — Header**

```markdown
<div align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" alt="orbit" />
  <h1>orbit</h1>
  <p><strong>A local-first, vim-first markdown notes app with a coding agent living inside it.</strong></p>
  <p>
    <a href="https://github.com/Octaviocossy/orbit-111/actions/workflows/ci.yml"><img src="https://github.com/Octaviocossy/orbit-111/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT" /></a>
    <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="macOS" />
  </p>
</div>
```

Use `src-tauri/icons/128x128@2x.png` — it exists and is committed. Do **not** invent a logo file.
Leave a `<!-- TODO: screenshot -->` comment under the header; there is no screenshot asset in the repo
and fabricating an image path would produce a broken README.

**1.2 — Why orbit** (~120 words, sourced from `doc/v0-spec.md` §1)

The problem: notes live in Obsidian, the agent lives in a terminal, and the work is the constant
context-switch between two windows. orbit collapses that into one — a real markdown editor on the left,
the agent in a panel on the right, both pointed at the same folder of `.md` files.

State the invariants that make it trustworthy: your notes are plain markdown in a folder you chose; the
app coexists with an existing Obsidian vault; there is no account, no server, no sync, and no API key —
agent credentials are inherited from CLIs you have already logged into.

**1.3 — Features** (bulleted, grouped by the three regions)

- **Vault** — opens any folder of `.md` files (Obsidian-compatible); filesystem watcher keeps the tree
  live when the agent writes a file; create notes/folders inline with `a` / `A`; root-guarded FS ops
  that reject symlink escapes.
- **Editor** — CodeMirror 6 with vim emulation on by default; multi-buffer tabs that keep undo history
  and cursor across switches; `[[wikilink]]` decoration; markdown syntax highlighting; live line:col and
  vim submode readout; `yy` / `y{motion}` / `V y` write to both the vim register *and* the system
  clipboard.
- **Agent** — chat panel rendering normalized agent events as native UI (message bubbles, tool chips,
  thinking indicator) rather than a terminal; Claude Code and Codex backends behind one `AgentBackend`
  interface; conversations autosaved as readable markdown under `<vault>/.orbit/chats/`.
- **Keyboard-first** — one window-level dispatcher, `Ctrl-w`-prefixed region chords, a Spotlight-like
  fuzzy file finder, and every app-level binding rebindable in `keymaps.toml`.
- **Config as files** — `settings.toml` and `keymaps.toml` are authoritative; the Settings dialog is a
  typed editor of them that preserves your comments and key order; both hot-reload on save.

**1.4 — Requirements**

| | |
|---|---|
| **OS** | macOS. It builds elsewhere but the custom titlebar is macOS-only (see ADR 0008), so Windows/Linux show a doubled title bar. |
| **Node** | ≥ 18 (Vite 7 / React 19) |
| **pnpm** | 10+ |
| **Rust** | stable toolchain + [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) |
| **Agent CLI** | [`claude`](https://claude.com/claude-code) and/or [`codex`](https://github.com/openai/codex), installed and logged in — optional, only for the chat panel |

**1.5 — Install & run**

```bash
git clone https://github.com/Octaviocossy/orbit-111.git
cd orbit-111
pnpm install
pnpm tauri dev        # run in development
pnpm tauri build      # produce a bundle in src-tauri/target/release/bundle/
```

Note there are no prebuilt releases yet.

**1.6 — Quick start** (numbered, five steps)

1. First launch creates and opens `~/Documents/orbit-brain`. Change it in Settings (`Ctrl-w s`) → Vault.
2. Opening a vault scaffolds `AGENTS.md` and `CLAUDE.md` into its root (hidden from the sidebar) — this
   is how the agent knows it is writing wikilinked notes rather than co-editing your open file.
3. `Ctrl-w f` opens the file finder; `a` in the sidebar starts a new note; `:w` or `Cmd-S` saves.
4. `Ctrl-w c` opens the chat. Pick a model from the pill in the input.
5. ⚠️ Call out explicitly: the default model is **GPT 5.4 mini**, which runs on the `codex` engine. If
   you only have Claude Code installed, switch to **Sonnet 5** or **Haiku 4.5** first, or the first turn
   fails with `CommandNotFound`.

**1.7 — Keybindings** (inline, full)

Reproduce the four tables below exactly — verified against `src/lib/keymap/defaults.ts`. Precede them
with one sentence on precedence: a single window-level dispatcher walks *editor → active region →
global*, first match wins with no fallthrough, and a chord sequence arms a 1.5 s window.

*Global — works anywhere focus isn't inside a text field*

| Keys | Command | Action |
|---|---|---|
| `Ctrl-w` `f` | `global.find-file` | Open the file finder |
| `Ctrl-w` `h` / `l` | `global.focus-previous` / `-next` | Cycle regions (sidebar → viewer → chat, wraps) |
| `Ctrl-w` `b` | `global.toggle-sidebar` | Toggle the sidebar |
| `Ctrl-w` `c` | `global.toggle-chat` | Toggle the chat panel |
| `Ctrl-w` `s` | `global.toggle-settings` | Toggle the settings dialog |
| `:` | `global.command-mode` | Open the command bar |

*Sidebar — when focused*

| Keys | Command | Action |
|---|---|---|
| `j` / `k` | `sidebar.cursor-down` / `-up` | Move the cursor |
| `l` / `Enter` | `sidebar.open` | Expand a directory, or open a file and focus the editor |
| `h` | `sidebar.collapse` | Collapse an expanded directory |
| `a` | `sidebar.new-note` | Name a new note |
| `A` | `sidebar.new-directory` | Name a new folder |

*Chat History tab — when focused*

| Keys | Command | Action |
|---|---|---|
| `j` / `k` | `chat.history.cursor-down` / `-up` | Move the cursor |
| `l` / `Enter` | `chat.history.open` | Load that conversation |

*Editor*

| Keys | Action |
|---|---|
| `:w` / `Cmd-S` | Save (`Cmd` on macOS, `Ctrl` elsewhere) |
| `yy` / `y{motion}` / `V` `y` | Yank to the vim register **and** the system clipboard |
| everything else | Standard `@replit/codemirror-vim` |

Close with: file-finder keys (`↑` `↓` `Enter` `Escape`), `Escape` to exit command mode, and `:w` are
**not** rebindable. Link `doc/keybindings.md` for the full reference.

**1.8 — Configuration**

Open the config dir line first — on macOS `~/Library/Application Support/com.ovct.orbit-111/`. Do
**not** write `~/.config/orbit-111/`; that is the bug being fixed in Step 7.

`settings.toml` — flat, camelCase, four keys (verified in `src-tauri/src/settings.rs`):

| Key | Type | Default | Accepted |
|---|---|---|---|
| `model` | string | `"gpt-5.4-mini"` | `gpt-5.4-mini`, `haiku-4.5`, `sonnet-5`, `gpt-5.5-fast` |
| `editorFont` | string | `"JetBrains Mono"` | any installed family name |
| `theme` | string | `"dark"` | `"dark"` \| `"light"` |
| `vaultPath` | string | `~/Documents/orbit-brain` | absolute path |

Explain per-key degradation in one sentence: an invalid *value* falls back for that key alone with a
diagnostic; only a genuine TOML *syntax* error rejects the document and blocks writes from the dialog.

`keymaps.toml` — ships fully commented out, one line per command, each showing its live default. It is
**command-keyed**, not chord-keyed (ADR 0005). Show one example and the three contract rules:

```toml
"global.find-file"    = ["ctrl-w f"]   # override replaces the default array wholesale
"sidebar.new-note"    = ["n", "a"]     # multiple chords are allowed
"global.toggle-chat"  = []             # empty array unbinds the command
```

Chord notation: spaces separate sequence steps, hyphens separate modifiers; `ctrl` `alt` `shift` `meta`
`mod` (`mod` = Cmd on macOS, Ctrl elsewhere).

Also mention: both files hot-reload on save, and both are openable inside orbit from the file finder.

**1.9 — Where your data lives**

| Path | Contents |
|---|---|
| `<vault>/**/*.md` | Your notes. Plain markdown, the source of truth. |
| `<vault>/AGENTS.md`, `<vault>/CLAUDE.md` | Agent instructions, auto-scaffolded, hidden from the sidebar |
| `<vault>/.orbit/chats/<id>.chat.md` | Conversations — markdown with frontmatter, readable in Obsidian |
| app-config dir | `settings.toml`, `keymaps.toml` |

**1.10 — Project structure** — a compact tree with a one-line purpose per top-level directory of `src/`
and `src-tauri/src/`. Keep it to ~20 lines; do not enumerate files.

**1.11 — Development** — the scripts table, verbatim from `package.json`:

| Command | Does |
|---|---|
| `pnpm dev` | Vite dev server (frontend only, port 1420) |
| `pnpm tauri dev` | Full desktop app in development |
| `pnpm build` | `tsc` type-check + Vite production build |
| `pnpm tauri build` | Bundle the desktop app |
| `pnpm test` | Vitest, run once (40 test files) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm coverage` | v8 coverage report |
| `pnpm test:rust` | `cargo test` for the Rust backend (103 tests) |
| `pnpm check` / `check:fix` | Biome lint + format |

**1.12 — Built with agents** (short — ~100 words + one table)

Explain that the repo is developed agent-first and that `.agents/` is committed on purpose: rules the
agent must follow, cross-agent slash commands (Claude Code + OpenCode), auto-loading skills, ADRs, and a
parallel epic runner. Table with counts — 9 rules, 13 commands, 5 skills, 11 ADRs — and link
`.agents/docs/workflow.en.md` (`workflow.es.md` for Spanish). Mention `.agents/ubiquitous-language.md`
as the domain glossary. Keep it to one screenful.

**1.13 — Roadmap** — from `doc/v0-spec.md` §2/§7, framed as "not in v0 yet": graph view / neural tree,
native provider backends (Anthropic/OpenAI/Ollama with an in-house tool loop), token-delta streaming,
per-action permission approval, wired `:` ex-commands, keyboard tab switching, chat delete UI,
Windows/Linux titlebar gating.

**1.14 — Contributing** — three lines pointing at `CONTRIBUTING.md`.

**1.15 — License** — MIT, link `LICENSE`.

**1.16 — Delete** the stock "Recommended IDE Setup" section. Move the "Agent Skills" table into §1.12.

---

> **Step 2 — `LICENSE`**
>
> - **File:** `LICENSE`
> - **Action:** CREATE
> - **Details:** Verbatim MIT text. Copyright line: `Copyright (c) 2026 Octavio Cossy Torquati`
>   (name from `git config user.name`; email is `octaviocossytorquati@gmail.com` if needed).
> - **Why:** Without it the repo is legally all-rights-reserved and every other doc's premise is false.

> **Step 3 — `CONTRIBUTING.md`**
>
> - **File:** `CONTRIBUTING.md`
> - **Action:** CREATE
> - **Why:** Keeps contributor detail out of the README while satisfying the full-OSS framing.
> - **Sections:**
>   1. **Getting set up** — prerequisites, clone, `pnpm install`, `pnpm tauri dev`.
>   2. **Before you open a PR** — `pnpm check`, `pnpm build`, `pnpm test`, and `pnpm test:rust` for any
>      change under `src-tauri/src/`.
>   3. **Testing conventions** — summarize `.agents/rules/testing.md`: co-locate tests
>      (`foo.ts` → `foo.test.ts`, no `__tests__/`), no global test APIs (import `describe`/`it`/`expect`
>      from `'vitest'` explicitly), Rust tests co-located in `#[cfg(test)] mod tests` named
>      `subject_should_expected_behavior`.
>   4. **The domain glossary** — read `.agents/ubiquitous-language.md` before touching `src/` or
>      `src-tauri/src/`; update it and its Changelog when introducing canonical vocabulary. State the
>      23 invariants are binding.
>   5. **The agent workflow** — brief: `/grill` → `/planning` or `/create-issue` → `/execute-issue`;
>      plans in `.agents/plans/`, specs in `.agents/specs/`, ADRs in `.agents/adr/`. Link
>      `.agents/docs/workflow.en.md`. Say plainly it is optional for outside contributors.
>   6. **Commit messages** — Conventional Commits (a `/commit-message` command exists).
>   7. **Design system** — UI work in `src/components` or `src/styles` must follow
>      `.agents/skills/orbit-design/SKILL.md`; the ember accent means *AI agency* only (ADR 0007,
>      invariant 21).
>   8. **Code style** — Biome 2.2.0 is the only linter/formatter; no ESLint, no Prettier.

> **Step 4 — CI workflow**
>
> - **File:** `.github/workflows/ci.yml`
> - **Action:** CREATE
> - **Why:** The README badge must be truthful, and there is currently no automated check at all.
> - **Details:** `name: CI`, triggers `on: push: branches: [main]` and `pull_request:`. Two jobs.
>
>   **Job `frontend`** (`ubuntu-latest`): `actions/checkout@v4` → `pnpm/action-setup@v4` with
>   `version: 10` → `actions/setup-node@v4` with `node-version: 20`, `cache: 'pnpm'` →
>   `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm build` → `pnpm test`.
>   `pnpm-lock.yaml` is committed, so `--frozen-lockfile` is safe.
>
>   **Job `rust`** (`macos-latest` — matches the only supported platform and avoids installing
>   `libwebkit2gtk` apt dependencies): checkout → pnpm/node setup → `pnpm install --frozen-lockfile` →
>   **`pnpm build`** → `dtolnay/rust-toolchain@stable` → `Swatinem/rust-cache@v2` with
>   `workspaces: src-tauri` → `pnpm test:rust`.
>
>   ⚠️ The `pnpm build` step in the Rust job is **load-bearing, not redundant**: `src-tauri/build.rs`
>   runs `tauri_build::build()`, which resolves `frontendDist: "../dist"`. Without a built `dist/`,
>   `cargo test` can fail at build script time. If it turns out to pass without it, the step may be
>   dropped — verify, don't assume.
>
>   Add `cargo fmt --check` and `cargo clippy` **only if** they pass on the current tree; neither is in
>   `package.json` today, so a failing check would land red CI on day one. Verify locally first.

> **Step 5 — `package.json` metadata**
>
> - **File:** `package.json`
> - **Action:** MODIFY
> - **Details:** Add alongside the existing `name`/`version`/`private`/`type`:
>   ```json
>   "description": "A local-first, vim-first markdown notes app with a built-in coding agent.",
>   "license": "MIT",
>   "repository": { "type": "git", "url": "git+https://github.com/Octaviocossy/orbit-111.git" },
>   "homepage": "https://github.com/Octaviocossy/orbit-111#readme",
>   "bugs": { "url": "https://github.com/Octaviocossy/orbit-111/issues" },
>   "engines": { "node": ">=18" },
>   "packageManager": "pnpm@10.0.0"
>   ```
> - **Why:** The README states these requirements; the manifest should enforce them rather than leave
>   them as prose in `AGENTS.md`.
> - ⚠️ `packageManager` is a **behavior change** — Corepack will then enforce that exact pnpm version.
>   The machine in use runs pnpm 11.18.0, which would be rejected by `pnpm@10.0.0`. Either set it to the
>   actual version in use or omit the field; do not blindly write `10.0.0`. Also update `AGENTS.md`
>   § Workspace, which currently says "pnpm @ 10 (unpinned — no `packageManager` field)".

> **Step 6 — `src-tauri/Cargo.toml` metadata**
>
> - **File:** `src-tauri/Cargo.toml`
> - **Action:** MODIFY
> - **Details:** Replace the untouched scaffold values `description = "A Tauri App"` and
>   `authors = ["you"]` with the real description and `authors = ["Octavio Cossy Torquati"]`. Add
>   `license = "MIT"` and `repository = "https://github.com/Octaviocossy/orbit-111"`.
> - **Why:** `authors = ["you"]` ships into bundle metadata.

> **Step 7 — Fix the wrong config path in `doc/keybindings.md`**
>
> - **File:** `doc/keybindings.md`, line 7
> - **Action:** MODIFY
> - **Details:** It reads ``~/.config/orbit-111/keymaps.toml``. On macOS the file is at
>   `~/Library/Application Support/com.ovct.orbit-111/keymaps.toml` — `config.rs` resolves it through
>   Tauri's `app_config_dir()`, which is *not* XDG on macOS. Replace with the macOS path and note it
>   varies by platform.
> - **Why:** A reader following the current text finds no file and concludes rebinding is broken.

> **Step 8 — Refresh `doc/tech-stack.md`**
>
> - **File:** `doc/tech-stack.md`
> - **Action:** MODIFY
> - **Details:** Three verified staleness bugs (the doc self-describes as a 2026-07-22 snapshot):
>   - Line 34 lists `@fontsource-variable/geist-mono`; `package.json` and `src/styles/index.css`
>     actually use **`@fontsource-variable/jetbrains-mono` ^5.3.0**.
>   - The Rust crate table omits `toml` 1, `toml_edit` 0.25, and `tauri-plugin-clipboard-manager`.
>   - The backend module table omits `config.rs` and `chats.rs`; `settings.rs` is described as
>     `serde_json`, but it moved to `toml`/`toml_edit` in #96.
>   - The frontend dep table omits `@codemirror/language`, `@codemirror/legacy-modes`, `@lezer/highlight`.
>   Also bump the snapshot date to 2026-08-08.
> - **Why:** The README links this doc; linking to a stale page is worse than not linking.

## Architecture Decisions

- **MIT over Apache-2.0** — no patent portfolio to defend, and MIT is the lowest-friction choice for a
  personal desktop app.
- **CI's Rust job runs on `macos-latest`, not `ubuntu-latest`** — Tauri on Linux needs
  `libwebkit2gtk-4.1-dev` and friends via `apt`, adding a slow, breakage-prone step to test a target
  the project does not support (ADR 0008). macOS runners match reality.
- **Key tables inline, deep reference linked** — the keybinding and `settings.toml` tables are short and
  are the two things a user looks up most; everything else (chord grammar, keymap-resolution contract,
  chat-file format, the 23 invariants) stays in `doc/` and `.agents/`, already written and more detailed
  than a README should be.
- **README states macOS-only plainly rather than aspirationally** — the alternative is issues from
  Linux users reporting a doubled title bar that ADR 0008 already predicted.
- **No fabricated assets** — the header uses the committed `src-tauri/icons/128x128@2x.png`; the
  screenshot is a TODO comment, not a broken `<img>`.

## Validation Criteria

- [ ] `README.md` renders correctly on GitHub — tables aligned, the `<div align="center">` header
      displays, the icon `<img>` resolves, no broken relative links. Check with
      `gh api -X POST /markdown -f text="$(cat README.md)"` or the GitHub preview.
- [ ] Every relative link resolves: `LICENSE`, `CONTRIBUTING.md`, `doc/keybindings.md`,
      `doc/v0-spec.md`, `doc/tech-stack.md`, `.agents/docs/workflow.en.md`,
      `.agents/ubiquitous-language.md`.
- [ ] Spot-check the keybinding table against `src/lib/keymap/defaults.ts` — every chord string matches
      exactly (`ctrl-w f`, `shift-a`, `mod-s`, …).
- [ ] Spot-check the `settings.toml` table against `src-tauri/src/settings.rs` — all four keys, their
      defaults, and `KNOWN_MODELS` match.
- [ ] `pnpm check` passes (Biome may reformat the JSON edits in Step 5).
- [ ] `pnpm build` passes.
- [ ] `pnpm test` passes (40 files).
- [ ] `pnpm test:rust` passes (103 tests) after the `Cargo.toml` metadata edit.
- [ ] The CI workflow is valid YAML and green on its first run. Verify locally by executing the exact
      job steps in order before pushing; if the Rust job needs `pnpm build`, confirm that empirically.
- [ ] The CI badge URL matches the workflow file name (`ci.yml`) — a mismatch renders a permanent
      "no status" badge.
- [ ] If `packageManager` was added, `pnpm install` still works on the local machine (Corepack version
      enforcement).

## Open Questions

- **The badge is invisible until the repo is public.** `Octaviocossy/orbit-111` is currently private, so
  the CI and license shields render as broken images to anyone without access. This does not block
  implementation, but the README is only fully correct once the repo is made public.
- **`packageManager` value** — see the warning in Step 5. Confirm the pnpm version to pin, or omit the
  field and leave the requirement as documentation only.
- **Two uncommitted ADRs describe unimplemented behavior.** `.agents/adr/0010-config-reachable-only-from-the-finder.md`
  (untracked in git status) and `0011-sidebar-collapses-to-a-rail.md` describe a *future* state: config
  reachable only from the finder, and a sidebar that collapses to a 40px rail rather than unmounting.
  Neither is in `src/` yet — `Sidebar.tsx:62` still returns `null` when hidden, and the pinned Config
  section still exists in `src/lib/vault/sidebar-rows.ts`. **The README documents shipped behavior**
  (config appears in both the sidebar's Config section and the finder; `Ctrl-w b` hides the sidebar).
  Flagging it so the README is revisited when those ADRs land.
