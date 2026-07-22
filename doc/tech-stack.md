# orbit-111 Tech Stack

orbit-111 is a Tauri 2 desktop app with two source trees: `src/` (React 19 + Vite 7 frontend,
TypeScript) and `src-tauri/src/` (Tauri 2 backend, Rust, edition 2021). `package.json` and
`src-tauri/Cargo.toml` are the source of truth for dependency versions — the tables below are a
**snapshot as of 2026-07-22**. For architecture rationale, see `doc/v0-spec.md`; for what each
module *does* (entities, stores, relationships), see `.agents/ubiquitous-language.md`.

## At a glance

| Tree | Language | Framework | Build / Tooling |
|------|----------|-----------|------------------|
| `src/` | TypeScript | React 19 | Vite 7 + Biome |
| `src-tauri/src/` | Rust (2021) | Tauri 2 | Cargo |

## Frontend — `src/`

### Runtime dependencies

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
| `@fontsource-variable/geist` / `@fontsource-variable/geist-mono` | ^5.2.x | Self-hosted sans and mono variable fonts, imported in `src/styles/index.css` |
| `@tauri-apps/api` | ^2 | Frontend↔Rust bridge (`invoke`, event `listen`) — used **only** in `src/services/*` and `src/lib/agent/backends/*` |
| `@tauri-apps/plugin-clipboard-manager` | ^2 | Native system clipboard writes (`src/services/clipboard.service.ts`) |
| `@tauri-apps/plugin-opener` | ^2 | JS side of the opener plugin |

### Dev & build tooling

| Tool | Version | Role |
|------|---------|------|
| `typescript` | ~5.8.3 | Language + `tsc` type-check in `pnpm build` |
| `vite` | ^7.0.4 | Dev server + bundler (`vite.config.ts`, port 1420) |
| `@vitejs/plugin-react` | ^4.6.0 | React Fast Refresh / JSX transform |
| `@biomejs/biome` | 2.2.0 | Lint + format (`biome.json`); replaces ESLint + Prettier |
| `@tauri-apps/cli` | ^2 | `tauri` CLI (dev/build orchestration) |
| `@types/react` / `@types/react-dom` | ^19.1.x | React type definitions |

### What each directory is built with

| Directory | Primary technologies |
|-----------|------------------------|
| `main.tsx` | React DOM client (`react-dom/client`), `StrictMode` |
| `App.tsx` | React; mounts the app's hooks |
| `components/ui/` | Radix `Slot` (`asChild`) + `class-variance-authority` + `cn()` |
| `components/{ai,layout,vault}/` | React + Tailwind + Zustand store selectors |
| `hooks/` | React hooks composed over the `services/` layer |
| `lib/agent/` | Plain TS event contract + backend registry; the concrete backends call `@tauri-apps/api` |
| `lib/editor/` | CodeMirror 6 (`@codemirror/view` + `@codemirror/state` + `@codemirror/lang-markdown` + `@replit/codemirror-vim`); custom system clipboard yank |
| `lib/vault/` + `lib/dom/` | Plain TS helpers, no external runtime deps |
| `lib/utils.ts` | `clsx` + `tailwind-merge` → the `cn()` helper |
| `services/` | `@tauri-apps/api` (`invoke` / `listen`) plus native plugin wrappers such as the system clipboard service |
| `stores/` | Zustand |
| `styles/` + `styles/tokens/` | Tailwind v4 (`@import "tailwindcss"`), Geist variable fonts, CSS-custom-property token layers |

## Backend — `src-tauri/src/`

### Crates

| Crate | Version | Role |
|-------|---------|------|
| `tauri` | 2 | Desktop app framework — `Builder`, `#[tauri::command]`, `State`, event `emit` |
| `tauri-build` | 2 | Build-time codegen (`build.rs`, build-dependency) |
| `tauri-plugin-dialog` | 2 | Native folder picker (vault pick) |
| `tauri-plugin-opener` | 2 | Open paths/URLs with the OS default handler |
| `tauri-plugin-log` | 2 | File + stdout logging plugin (`src-tauri/src/logging.rs`) |
| `tauri-plugin-clipboard-manager` | 2 | Native system clipboard writes, authorized by `clipboard-manager:allow-write-text` |
| `serde` (derive) | 1 | Serialize/deserialize domain structs across the IPC boundary |
| `serde_json` | 1 | JSON (settings file, agent stream parsing) |
| `notify` | 7 | Filesystem watcher for the open vault (`src-tauri/src/vault.rs`) |
| `thiserror` | 2 | Ergonomic error enums (`VaultError`, `CommandNotFound`, …) |
| `log` | 0.4 | Logging facade the whole backend logs through |

### What each module is built with

| File | Primary technologies |
|------|------------------------|
| `main.rs` | Thin binary entry; calls `orbit_111_lib::run()` |
| `lib.rs` | `tauri::Builder` — registers the log/opener/dialog/clipboard plugins, `manage`s `VaultState` + `AgentProcessState`, and registers frontend commands |
| `vault.rs` | `notify` watcher, `serde`, `std::fs`, Tauri `command`/`State`/`emit`; `VaultState`, `VaultError`, the guarded vault commands, `scaffold_agent_context` |
| `agent.rs` | `std::process` child spawning, PATH resolution, Tauri `State`/`emit`; `AgentProcessState`, `agent_spawn`/`agent_send`/`agent_stop` |
| `settings.rs` | `serde` + `serde_json` + `std::fs`, Tauri app-config-dir path; `Settings`, default vault |
| `logging.rs` | `tauri-plugin-log` + `log`; `logging::plugin()`, `LogResult::log_err` |

## Build & config glue

| File | Technology | Purpose |
|------|------------|---------|
| `vite.config.ts` | Vite + `@vitejs/plugin-react` + `@tailwindcss/vite` | `@` → `src` path alias; fixed port 1420 for Tauri |
| `tsconfig.json` / `tsconfig.node.json` | TypeScript | Strict mode, bundler resolution, `@/*` paths |
| `biome.json` | Biome | Lint/format config (v2.2.0 schema) |
| `src-tauri/tauri.conf.json` | Tauri config | `beforeDevCommand`/`beforeBuildCommand` = pnpm, `frontendDist` = `../dist`, window + bundle settings |
| `src-tauri/build.rs` | `tauri-build` | Runs `tauri_build::build()` |

## Source of truth

`package.json` (frontend) and `src-tauri/Cargo.toml` (backend) are authoritative for versions.
This doc is a snapshot — update the version tables when a dependency is added, removed, or
bumped. Common commands (see `AGENTS.md`): `pnpm dev`, `pnpm build`, `pnpm check`.
