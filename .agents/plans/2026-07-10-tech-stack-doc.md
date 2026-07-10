# Plan: Tech-Stack Doc — Technologies Used in Each `src`

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: — (none)

## Goal

Create a single reference doc — `doc/tech-stack.md` — that explains **which technologies power each of the two source trees** (`src/`, the TypeScript/React frontend, and `src-tauri/src/`, the Rust/Tauri backend), broken down directory-by-directory, so a new contributor can answer "what is this folder built with?" without reading `package.json`, `Cargo.toml`, and every import by hand.

## Context

**Current state:** orbit-111 is a single-package Tauri 2 desktop app with two source trees:

- `src/` — React 19 + Vite 7 frontend (TypeScript).
- `src-tauri/src/` — Tauri 2 backend (Rust, edition 2021).

The existing docs are `doc/v0-spec.md` (architecture/decision narrative) and `doc/keybindings.md` (keybinding reference). **Neither is a tech-stack map.** The dependency truth is currently spread across `package.json`, `src-tauri/Cargo.toml`, `vite.config.ts`, `tsconfig.json`, `biome.json`, and `tauri.conf.json`, and the *per-directory* usage (which folder leans on which library) is only discoverable by grepping imports. `.agents/ubiquitous-language.md` describes what each module *does* but not what it's *built with*.

**Trigger:** user request — "let's make a doc explaining the technologies used in each src."

**Constraints:**
- Documentation only — **no** source, config, or behavior changes (per `.agents/commands/planning.md`).
- Live in `doc/`, matching the existing docs convention (`doc/v0-spec.md`, `doc/keybindings.md`).
- Must not duplicate `doc/v0-spec.md`'s architectural prose — link to it for *why*, and stay focused on *what tech, where*.
- Versions drift, so the doc must name `package.json` / `src-tauri/Cargo.toml` as the source of truth and mark its version table as a snapshot.

**Full technology inventory (the exhaustive source of truth for Step 1 — gathered by reading the manifests, configs, and grepping imports across both trees):**

### Frontend `src/` — runtime dependencies (`package.json`)

| Package | Version | Role |
|---------|---------|------|
| `react` / `react-dom` | ^19.1.0 | UI framework; `react-dom/client` `createRoot` in `src/main.tsx` (StrictMode) |
| `zustand` | ^5.0.14 | State management — every file in `src/stores/` is a Zustand store |
| `@uiw/react-codemirror` | ^4.25.10 | React wrapper mounting the CodeMirror 6 editor (`src/components/layout/Viewer.tsx`) |
| `@codemirror/view` | ^6.43.6 | CM6 view layer — decorations, keymaps, `Prec` (`src/lib/editor/*`) |
| `@codemirror/state` | ^6.7.1 | CM6 state/extension primitives (`src/lib/editor/*`) |
| `@codemirror/lang-markdown` | ^6.5.0 | Markdown language support for the editor |
| `@replit/codemirror-vim` | ^6.3.0 | Vim emulation + `Vim.defineEx` for `:w` (`src/lib/editor/save.ts`, `vim-mode-sync.ts`) |
| `tailwindcss` | ^4.3.2 | Utility CSS framework (Tailwind v4), imported in `src/styles/index.css` |
| `@tailwindcss/vite` | ^4.3.2 | Tailwind v4 Vite plugin (wired in `vite.config.ts`) |
| `class-variance-authority` | ^0.7.1 | Variant styling for `src/components/ui/{button,badge}.tsx` |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.6.0 | The `cn()` classname helper — **only** in `src/lib/utils.ts` |
| `@radix-ui/react-slot` | ^1.3.0 | `asChild` slot pattern — **only** in `src/components/ui/button.tsx` |
| `@fontsource/jetbrains-mono` | ^5.2.8 | Self-hosted mono font, imported in `src/styles/index.css` (weights 300–700) |
| `@tauri-apps/api` | ^2 | Frontend↔Rust bridge (`invoke`, event `listen`) — used **only** in `src/services/*` and `src/lib/agent/backends/*` |
| `@tauri-apps/plugin-opener` | ^2 | JS side of the opener plugin |

### Frontend `src/` — dev/build tooling (`package.json` devDependencies + configs)

| Tool | Version | Role |
|------|---------|------|
| `typescript` | ~5.8.3 | Language + `tsc` type-check in `pnpm build` |
| `vite` | ^7.0.4 | Dev server + bundler (`vite.config.ts`, port 1420) |
| `@vitejs/plugin-react` | ^4.6.0 | React Fast Refresh / JSX transform |
| `@biomejs/biome` | 2.2.0 | Lint + format (`biome.json`); replaces ESLint + Prettier |
| `@tauri-apps/cli` | ^2 | `tauri` CLI (dev/build orchestration) |
| `@types/react` / `@types/react-dom` | ^19.1.x | React type definitions |

### Frontend import-usage map (grep-confirmed — anchors the per-directory section)

- `@tauri-apps/api` → `src/services/{vault,settings,agent-process}.service.ts`, `src/lib/agent/backends/{claude-code,codex}.backend.ts`
- `class-variance-authority` → `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`
- `clsx` + `tailwind-merge` → `src/lib/utils.ts` only
- `zustand` → all six `src/stores/*.ts`
- CodeMirror / `@replit/codemirror-vim` → `src/components/layout/Viewer.tsx`, all `src/lib/editor/*`
- `@radix-ui/react-slot` → `src/components/ui/button.tsx` only
- `react-dom/client` → `src/main.tsx`
- `src/styles/index.css` → `@import "tailwindcss"`, five `@fontsource/jetbrains-mono` weight imports, then the five `src/styles/tokens/*.css` files, then a shadcn⇄Orbit semantic mapping layer

### Backend `src-tauri/src/` — crates (`src-tauri/Cargo.toml`)

| Crate | Version | Role |
|-------|---------|------|
| `tauri` | 2 | Desktop app framework — `Builder`, `#[tauri::command]`, `State`, event `emit` |
| `tauri-build` | 2 | Build-time codegen (`build.rs`, build-dependency) |
| `tauri-plugin-dialog` | 2 | Native folder picker (vault pick) |
| `tauri-plugin-opener` | 2 | Open paths/URLs with the OS default handler |
| `tauri-plugin-log` | 2 | File + stdout logging plugin (`src-tauri/src/logging.rs`) |
| `serde` (derive) | 1 | Serialize/deserialize domain structs across the IPC boundary |
| `serde_json` | 1 | JSON (settings file, agent stream parsing) |
| `notify` | 7 | Filesystem watcher for the open vault (`src-tauri/src/vault.rs`) |
| `thiserror` | 2 | Ergonomic error enums (`VaultError`, `CommandNotFound`, …) |
| `log` | 0.4 | Logging facade the whole backend logs through |

### Backend module map (per `.rs` file — from `src-tauri/src/lib.rs` + the glossary)

- `main.rs` — thin binary entry; calls `orbit_111_lib::run()`.
- `lib.rs` — `tauri::Builder`: registers the log/opener/dialog plugins, `manage`s `VaultState` + `AgentProcessState`, and `invoke_handler`s all 12 commands.
- `vault.rs` — `notify` watcher, `serde`, `std::fs`, Tauri `command`/`State`/`emit`; `VaultState`, `VaultError`, the guarded vault commands, `scaffold_agent_context`.
- `agent.rs` — `std::process` child spawning, PATH resolution, Tauri `State`/`emit`; `AgentProcessState`, `agent_spawn`/`agent_send`/`agent_stop`.
- `settings.rs` — `serde` + `serde_json` + `std::fs`, Tauri app-config-dir path; `Settings`, default vault.
- `logging.rs` — `tauri-plugin-log` + `log`; `logging::plugin()`, `LogResult::log_err`.

### Config/glue files (belong in a short "build glue" section)

- `vite.config.ts` — Vite + `@vitejs/plugin-react` + `@tailwindcss/vite`; `@` → `src` path alias; fixed port 1420 for Tauri.
- `tsconfig.json` / `tsconfig.node.json` — TypeScript strict, bundler resolution, `@/*` paths.
- `biome.json` — Biome lint/format config (v2.2.0 schema).
- `src-tauri/tauri.conf.json` — Tauri app config: `beforeDevCommand`/`beforeBuildCommand` = pnpm, `frontendDist` = `../dist`, window + bundle.
- `src-tauri/build.rs` — runs `tauri_build::build()`.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `doc/tech-stack.md` | New per-`src` technology reference doc |
| MODIFY | `README.md` | Add a one-line link to the new doc **only if** the README already has a docs/links section (conditional — see Step 3) |

## Step-by-Step Implementation

> **Step 1 — Create `doc/tech-stack.md`**
>
> - **File:** `doc/tech-stack.md`
> - **Action:** CREATE
> - **Details:** Author a GitHub-flavored-markdown reference doc with the structure below. Populate every table from the **Context** inventory above (do not re-derive — it is already grep-/manifest-confirmed). Keep prose tight; this is a reference, not a tutorial.
>
>   1. **Title + intro** — `# orbit-111 Tech Stack`. One paragraph: orbit-111 is a Tauri 2 desktop app with two source trees — `src/` (React 19 + Vite 7 frontend, TypeScript) and `src-tauri/src/` (Tauri 2 backend, Rust). State that `package.json` and `src-tauri/Cargo.toml` are the source of truth for versions and that the tables below are a **snapshot as of 2026-07-10**. Link to `doc/v0-spec.md` for architecture rationale and `.agents/ubiquitous-language.md` for what each module *does*.
>
>   2. **Section: At a glance** — a small two-row table: `Tree | Language | Framework | Build/Tooling`, one row for `src/` (TypeScript · React 19 · Vite 7 + Biome) and one for `src-tauri/src/` (Rust 2021 · Tauri 2 · Cargo).
>
>   3. **Section: Frontend — `src/`** — subsections:
>      - **Runtime dependencies** — reproduce the "Frontend `src/` — runtime dependencies" table (Package | Version | Role).
>      - **Dev & build tooling** — reproduce the "Frontend `src/` — dev/build tooling" table (Tool | Version | Role).
>      - **What each directory is built with** — a table `Directory | Primary technologies` covering: `main.tsx` (React DOM client, StrictMode), `App.tsx` (React; mounts hooks), `components/ui/` (Radix Slot + class-variance-authority + `cn`), `components/{ai,layout,vault}/` (React + Tailwind + Zustand selectors), `hooks/` (React hooks over services), `lib/agent/` (plain TS event contract + registry; backends call `@tauri-apps/api`), `lib/editor/` (CodeMirror 6: `@codemirror/view`+`state`+`lang-markdown`+`@replit/codemirror-vim`), `lib/vault/` + `lib/dom/` (plain TS helpers), `lib/utils.ts` (`clsx` + `tailwind-merge` → `cn`), `services/` (`@tauri-apps/api` `invoke`/`listen`), `stores/` (Zustand), `styles/` + `styles/tokens/` (Tailwind v4 `@import`, `@fontsource/jetbrains-mono`, CSS-custom-property token layers). Ground each row in the "Frontend import-usage map".
>
>   4. **Section: Backend — `src-tauri/src/`** — subsections:
>      - **Crates** — reproduce the "Backend `src-tauri/src/` — crates" table (Crate | Version | Role).
>      - **What each module is built with** — a table `File | Primary technologies` from the "Backend module map" (`main.rs`, `lib.rs`, `vault.rs`, `agent.rs`, `settings.rs`, `logging.rs`).
>
>   5. **Section: Build & config glue** — a table `File | Technology | Purpose` from the "Config/glue files" list (`vite.config.ts`, `tsconfig*.json`, `biome.json`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`).
>
>   6. **Footer** — "Source of truth: `package.json` (frontend), `src-tauri/Cargo.toml` (backend). This doc is a snapshot — update the version tables when a dependency is added, removed, or bumped." Optionally note the `pnpm` commands (`pnpm dev`, `pnpm build`, `pnpm check`) from `AGENTS.md`.
>
> - **Why:** One scannable map of what powers each folder; the snapshot + source-of-truth note keeps it honest as deps change.

> **Step 2 — Cross-check the doc against the manifests before finalizing**
>
> - **Action:** Re-open `package.json` and `src-tauri/Cargo.toml` and confirm every package name and version in the doc's tables matches exactly (including the `^`/`~`/bare specifiers). Re-run the four import greps from the Context "import-usage map" (`@tauri-apps/api`, `class-variance-authority`, `clsx`/`tailwind-merge`, `zustand`, CodeMirror, `@radix-ui/react-slot`) and confirm the per-directory rows still match the code.
> - **Why:** The doc's entire value is accuracy — a wrong version or a mislabeled directory is worse than no doc.

> **Step 3 — Link from `README.md` (conditional)**
>
> - **File:** `README.md`
> - **Action:** MODIFY (only if warranted)
> - **Details:** Read `README.md`. If it has a "Docs"/"Learn more"/links section, add one line: `- [Tech stack](doc/tech-stack.md)`. If the README is the unmodified default Tauri + React + TypeScript template (title + "Recommended IDE Setup" only) with no docs section, **skip this step** and note in the plan that it was skipped and why — do **not** invent a new section (this mirrors the decision made in `.agents/plans/2026-07-09-keybindings-doc.md`).
> - **Why:** Makes the doc discoverable without forcing an unrelated README restructure.

## Architecture Decisions

- **Standalone doc in `doc/`, not folded into `v0-spec.md`.** `doc/v0-spec.md` stays the architecture/decision narrative; `doc/tech-stack.md` is a purely referential companion, matching the same split already used for `doc/keybindings.md`.
- **Per-directory tables, not just a flat dependency list.** The user asked for "technologies used in **each** src," so the doc's spine is a directory/module → technology map, grounded in grep-confirmed imports rather than a raw `package.json` dump.
- **Versions are a dated snapshot with a named source of truth.** Rather than omit versions (less useful) or pretend they're authoritative (goes stale), the doc states the snapshot date and points at `package.json` / `Cargo.toml`.
- **No source/behavior changes.** Per `.agents/commands/planning.md`, this plan produces documentation only.

## Validation Criteria

- [x] `doc/tech-stack.md` exists and contains: intro, "At a glance", Frontend (runtime deps + tooling + per-directory), Backend (crates + per-module), Build & config glue, and the source-of-truth footer.
- [x] Every version in the doc matches `package.json` / `src-tauri/Cargo.toml` exactly (Step 2).
- [x] Every per-directory / per-module row is consistent with the current imports (Step 2 greps).
- [x] The doc links back to `doc/v0-spec.md` and `.agents/ubiquitous-language.md` rather than re-explaining architecture.
- [x] `pnpm check` still passes (docs-only change; confirms nothing else was touched — Biome ignores `doc/`, so this is just a safety net).
- [x] README updated with a link **only if** an existing docs/links section was found (Step 3); otherwise explicitly skipped with a note. **Skipped**: `README.md` is still the unmodified default Tauri + React + TypeScript template (title + "Recommended IDE Setup" only), no docs/links section exists — per the plan's own instruction, no new section was invented.

## Open Questions

None. (Filename chosen as `doc/tech-stack.md` to match the `doc/*.md` convention; if you'd prefer `doc/technologies.md` or `doc/architecture-stack.md`, say so before Step 1.)
