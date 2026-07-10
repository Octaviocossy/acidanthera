# Plan: Settings model selector (replace the engine picker with a model picker)

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none_

## Goal

Let the user choose which **model** the AI chat runs, from the Settings dialog. Replace the
Claude Code / Codex **engine** buttons with a list of concrete models — **GPT 5.4 mini**,
**Haiku 4.5**, **Sonnet 5**, **GPT 5.5 fast** — where each model determines both the engine
(which CLI is spawned) and the exact `--model` string that CLI is spawned with. The engine
stops being a directly-chosen setting and becomes a value *derived* from the selected model.

## Context

- **What exists today:**
  - `Settings.engine` is an `AgentSource` (`'claude-code' | 'codex'`), persisted in
    `settings.json` (TS: `src/services/settings.service.ts`; Rust: `src-tauri/src/settings.rs`).
  - `SettingsDialog` (`src/components/layout/SettingsDialog.tsx`) renders an **"Engine"** row:
    one `Badge` button per registered backend (`listBackends()`), each calling
    `updateSettings({ engine })` **and** `useChatStore.setBackend(engine)`.
  - `useChatStore` (`src/stores/chat-store.ts`) holds `backendId: AgentSource`, exposes
    `setBackend`, and in `sendMessage` looks the backend up via `getBackend(backendId)` and
    calls `backend.start(vaultRoot, onEvent)` — **no model is passed**.
  - The two backends spawn their CLIs **without any `--model` flag**, so each uses the CLI's
    own default model:
    - Claude Code (`src/lib/agent/backends/claude-code.backend.ts`): one long-lived process
      spawned in `start` with `CLAUDE_ARGS`.
    - Codex (`src/lib/agent/backends/codex.backend.ts`): a fresh process per `send`, args
      built from `CODEX_BASE_ARGS` (first turn) or `exec resume <threadId>` (later turns).
  - `useSettingsBootstrap` (`src/hooks/use-settings-bootstrap.ts`) seeds the chat at boot:
    `if (getBackend(settings.engine) && !sessionStarted) setBackend(settings.engine)`.
  - The ChatPanel engine selector was already removed (see
    `.agents/plans/2026-07-10-remove-chat-engine-selector.md`); Settings is already the
    **only** place engines are chosen. This plan changes *what* that single control selects.
- **What prompted this work:** The user can switch engine but not model. They want the
  engine buttons gone and a model list in their place.
- **Model → engine mapping (the crux):** a model implies its engine.

  | Model (label) | id | engine (`AgentSource`) | CLI `--model` value |
  |---------------|----|------------------------|---------------------|
  | GPT 5.4 mini | `gpt-5.4-mini` | `codex` | `gpt-5.4-mini` |
  | Haiku 4.5 | `haiku-4.5` | `claude-code` | `claude-haiku-4-5-20251001` |
  | Sonnet 5 | `sonnet-5` | `claude-code` | `claude-sonnet-5` |
  | GPT 5.5 fast | `gpt-5.5-fast` | `codex` | `gpt-5.5-fast` |

  (The user wrote "sonet 5" — canonical spelling is **Sonnet 5**.)
- **Reference set (verified by grep):** every reference to `engine` / `backendId` /
  `setBackend` lives in exactly these files — `SettingsDialog.tsx`, `use-settings-bootstrap.ts`,
  `settings.service.ts`, `chat-store.ts`, `settings.rs`. `AgentBackend.start` has exactly **one**
  caller: `chat-store.ts:105`. `listBackends` is used only by `SettingsDialog` (removed here)
  and stays as unused-but-exported registry API (Biome does not flag unused exports).
- **No tests reference this** — the repo has no JS test runner (`AGENTS.md` → Commands → Test).
  `settings.rs` has Rust `#[cfg(test)]` tests that assert on the `engine` field; those must be
  updated to `model`.
- **Domain rule:** `.agents/rules/domain-glossary.md` requires updating
  `.agents/ubiquitous-language.md` when domain entities/relationships change. This introduces a
  new entity (`AgentModel`) and changes several relationships, so the glossary edit is mandatory.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/agent/model-catalog.ts` | The `AgentModel` type, the `AGENT_MODELS` catalog, `AgentModelId`, `listModels`/`getModel`, `DEFAULT_MODEL_ID` |
| MODIFY | `src/lib/agent/agent-backend.ts` | `start` gains a `model: string` parameter |
| MODIFY | `src/lib/agent/backends/claude-code.backend.ts` | `start(cwd, model, onEvent)`; append `--model <model>` to spawn args |
| MODIFY | `src/lib/agent/backends/codex.backend.ts` | `start` records `model`; each `send` inserts `--model <model>` into the args |
| MODIFY | `src/stores/chat-store.ts` | `backendId`→`modelId`, `setBackend`→`setModel`; derive engine from the catalog; pass `cliModel` to `start` |
| MODIFY | `src/services/settings.service.ts` | `Settings.engine: AgentSource` → `Settings.model: AgentModelId` |
| MODIFY | `src-tauri/src/settings.rs` | `engine` field → `model`; default; write log; tests |
| MODIFY | `src/hooks/use-settings-bootstrap.ts` | Seed the model (catalog-validated) instead of the engine |
| MODIFY | `src/components/layout/SettingsDialog.tsx` | "Engine" row → "Model" row driven by `listModels()` |
| MODIFY | `.agents/ubiquitous-language.md` | Add `AgentModel`; update `Settings`/`AgentBackend`/`Chat store`/`SettingsDialog`/`useSettingsBootstrap` entries, relationships, flagged ambiguity, changelog, "Last updated" |

No files are deleted. `AgentSource` and the backend registry are unchanged.

## Step-by-Step Implementation

Do the steps in order: the catalog (Step 1) is imported by every later TS step.

> **Step 1 — Create the model catalog**
>
> - **File:** `src/lib/agent/model-catalog.ts`
> - **Action:** CREATE
> - **Details:**
>   - Import the engine type: `import type { AgentSource } from './agent-event';`
>   - Export the shape and the closed id union (explicit union, matching the house style of
>     `AgentSource`; the union and `AGENT_MODELS` must stay in sync):
>     ```ts
>     /** A user-selectable LLM. The `engine` is which CLI backend runs it; `cliModel` is the
>      *  exact string passed to that CLI's `--model` flag. Selecting a model selects its engine. */
>     export interface AgentModel {
>       /** Stable id persisted in `settings.json` (`Settings.model`). */
>       id: AgentModelId;
>       /** Human label for the Settings model picker. */
>       label: string;
>       /** Which `AgentBackend` (CLI) runs this model — derived, never persisted separately. */
>       engine: AgentSource;
>       /** Value passed to the CLI's `--model` flag when the backend spawns. */
>       cliModel: string;
>     }
>
>     export type AgentModelId = 'gpt-5.4-mini' | 'haiku-4.5' | 'sonnet-5' | 'gpt-5.5-fast';
>     ```
>   - Export the catalog and helpers:
>     ```ts
>     export const AGENT_MODELS: readonly AgentModel[] = [
>       { id: 'gpt-5.4-mini', label: 'GPT 5.4 mini', engine: 'codex', cliModel: 'gpt-5.4-mini' },
>       { id: 'haiku-4.5', label: 'Haiku 4.5', engine: 'claude-code', cliModel: 'claude-haiku-4-5-20251001' },
>       { id: 'sonnet-5', label: 'Sonnet 5', engine: 'claude-code', cliModel: 'claude-sonnet-5' },
>       { id: 'gpt-5.5-fast', label: 'GPT 5.5 fast', engine: 'codex', cliModel: 'gpt-5.5-fast' },
>     ];
>
>     /** Default model for a fresh install / pre-load chat state. MUST match Rust `default_model()`.
>      *  NB: its engine is `codex`, which may not be installed locally — see Architecture Decisions. */
>     export const DEFAULT_MODEL_ID: AgentModelId = 'gpt-5.4-mini';
>
>     export function listModels(): readonly AgentModel[] {
>       return AGENT_MODELS;
>     }
>
>     /** Looks a model up by id; `undefined` for an unknown id (e.g. a hand-edited settings file). */
>     export function getModel(id: string): AgentModel | undefined {
>       return AGENT_MODELS.find((model) => model.id === id);
>     }
>     ```
> - **Why:** One source of truth mapping the user-facing model to its engine and CLI flag, so the
>   UI, the chat store, and the boot seed all agree and adding a model is a one-line catalog edit.

> **Step 2 — Add `model` to the `AgentBackend.start` contract**
>
> - **File:** `src/lib/agent/agent-backend.ts`
> - **Action:** MODIFY
> - **Details:**
>   - Change the `start` signature to take the model between `cwd` and `onEvent`:
>     ```ts
>     /**
>      * Starts a session rooted at `cwd` (the vault root) running `model` (the backend passes it
>      * to the CLI's `--model` flag), invoking `onEvent` for each normalized `AgentEvent`.
>      */
>     start(cwd: string, model: string, onEvent: (event: AgentEvent) => void): Promise<void>;
>     ```
>   - Leave `id`, `label`, `send`, `stop` unchanged.
> - **Why:** The model is fixed for a session (changing it restarts the session), so it belongs
>   alongside `cwd` as a `start` parameter — keeping backends decoupled from the stores.

> **Step 3 — Pass `--model` in the Claude Code backend**
>
> - **File:** `src/lib/agent/backends/claude-code.backend.ts`
> - **Action:** MODIFY
> - **Details:**
>   - Change the `start` method signature to `async start(cwd, model, onEvent) {`.
>   - Change the spawn call to append the flag (keep `CLAUDE_ARGS` as the base const):
>     ```ts
>     await agentProcessService.spawn(CLAUDE_COMMAND, [...CLAUDE_ARGS, '--model', model], cwd);
>     ```
>   - Nothing else in this file changes (`send`, `stop`, the translators are untouched).
> - **Why:** Claude Code spawns one long-lived process in `start`, so the model is known and
>   baked into the args exactly once, at session start.

> **Step 4 — Pass `--model` in the Codex backend**
>
> - **File:** `src/lib/agent/backends/codex.backend.ts`
> - **Action:** MODIFY
> - **Details:**
>   - Replace the base-args const so the flags can be reused around the per-turn `--model`:
>     ```ts
>     const CODEX_FLAGS = ['--json', '--full-auto'];
>     ```
>     (Delete `const CODEX_BASE_ARGS = ['exec', '--json', '--full-auto'];` — leaving it unused
>     would fail Biome's `noUnusedVariables`.)
>   - Add a closure variable next to the existing `let cwd = '';`:
>     ```ts
>     let model = '';
>     ```
>   - Record it in `start` (Codex spawns per-`send`, so `start` only captures state):
>     ```ts
>     async start(startCwd, startModel, startOnEvent) {
>       cwd = startCwd;
>       model = startModel;
>       onEvent = startOnEvent;
>       threadId = undefined;
>     },
>     ```
>   - In `send`, build the args with `--model` for both the first turn and the resume turn
>     (replace the current `const args = threadId ? [...] : [...CODEX_BASE_ARGS, prompt];` line):
>     ```ts
>     const args = threadId
>       ? ['exec', 'resume', threadId, '--model', model, ...CODEX_FLAGS, prompt]
>       : ['exec', '--model', model, ...CODEX_FLAGS, prompt];
>     await agentProcessService.spawn(CODEX_COMMAND, args, cwd);
>     ```
> - **Why:** Codex runs one turn per process, so every spawn (first turn and each resume) must
>   carry the `--model` flag; storing `model` at `start` keeps it available across the sends.

> **Step 5 — Track the model (not the engine) in the chat store**
>
> - **File:** `src/stores/chat-store.ts`
> - **Action:** MODIFY
> - **Details:**
>   - **Imports:** drop `AgentSource` from the `agent-event` import (it becomes unused) and add
>     the catalog imports:
>     ```ts
>     import type { AgentEvent, ToolCallStatus } from '@/lib/agent/agent-event';
>     import { getBackend } from '@/lib/agent/backend-registry';
>     import { DEFAULT_MODEL_ID, getModel } from '@/lib/agent/model-catalog';
>     import type { AgentModelId } from '@/lib/agent/model-catalog';
>     import { useAppStore } from './app-store';
>     ```
>   - **State interface:** replace `backendId: AgentSource;` with `modelId: AgentModelId;`,
>     update the `sessionStarted` doc comment to say "for the current `modelId`", and replace
>     `setBackend: (id: AgentSource) => void;` with `setModel: (id: AgentModelId) => void;`.
>   - **Initial state:** `backendId: 'claude-code',` → `modelId: DEFAULT_MODEL_ID,`.
>   - **`setModel`** (replaces `setBackend`): stop the running backend whenever the model changes
>     at all — even a same-engine model switch (e.g. Haiku 4.5 → Sonnet 5) needs a restart because
>     `--model` is baked into the spawn args at `start`:
>     ```ts
>     setModel: (modelId) => {
>       const state = get();
>       if (modelId === state.modelId) return;
>       if (state.sessionStarted) {
>         const engine = getModel(state.modelId)?.engine;
>         if (engine) void getBackend(engine)?.stop();
>       }
>       set({ modelId, sessionStarted: false, turnActive: false });
>     },
>     ```
>   - **`sendMessage`:** resolve the model, derive the engine, and pass `cliModel` to `start`.
>     Replace the current backend lookup:
>     ```ts
>     const backend = getBackend(get().backendId);
>     if (!backend) return;
>     ```
>     with:
>     ```ts
>     const model = getModel(get().modelId);
>     if (!model) return;
>     const backend = getBackend(model.engine);
>     if (!backend) return;
>     ```
>     and change the start call from `await backend.start(vaultRoot, (event) => …)` to:
>     ```ts
>     await backend.start(vaultRoot, model.cliModel, (event) => set((state) => applyAgentEvent(state, event)));
>     ```
>   - `applyAgentEvent` and the `ChatItem`/`ChatToolCall` types are unchanged.
> - **Why:** The chat's identity is now "the selected model"; the engine and CLI flag are looked
>   up from the catalog at send time, so the store never persists a redundant engine value.

> **Step 6 — Change the persisted setting from `engine` to `model` (TS)**
>
> - **File:** `src/services/settings.service.ts`
> - **Action:** MODIFY
> - **Details:**
>   - Replace the import `import type { AgentSource } from '@/lib/agent/agent-event';` with
>     `import type { AgentModelId } from '@/lib/agent/model-catalog';`.
>   - In the `Settings` interface replace:
>     ```ts
>     /** The agent engine seeded into the chat at boot. */
>     engine: AgentSource;
>     ```
>     with:
>     ```ts
>     /** The agent model seeded into the chat at boot; its engine is derived from the catalog. */
>     model: AgentModelId;
>     ```
>   - Leave `editorFont`, `theme`, `vaultPath` and the `settingsService` methods unchanged.
> - **Why:** The persisted contract now stores the model; the engine is derived, so persisting it
>   separately would reintroduce the model/engine-can-disagree ambiguity.

> **Step 7 — Change the persisted setting from `engine` to `model` (Rust)**
>
> - **File:** `src-tauri/src/settings.rs`
> - **Action:** MODIFY
> - **Details:**
>   - Module doc comment (line ~2): "holding the agent engine, editor font, …" → "holding the
>     agent model, editor font, …".
>   - Rename the default fn:
>     ```rust
>     fn default_model() -> String {
>         "gpt-5.4-mini".into()
>     }
>     ```
>     (Delete `default_engine`. `"gpt-5.4-mini"` MUST match TS `DEFAULT_MODEL_ID`.)
>   - In `struct Settings`, `pub engine: String,` → `pub model: String,`.
>   - In `impl Default`, `engine: default_engine(),` → `model: default_model(),`.
>   - In `write_settings`, update the log line:
>     ```rust
>     log::info!(
>         "write_settings: model={} theme={} vault_path={}",
>         settings.model,
>         settings.theme,
>         settings.vault_path
>     );
>     ```
>   - Tests:
>     - `settings_should_fill_missing_fields_when_deserializing`: the input `{ "theme": "light" }`
>       now also proves the `engine`→`model` migration (old files with no `model` get the default).
>       Change the assertion tuple from `settings.engine.as_str()` / `"claude-code"` to
>       `settings.model.as_str()` / `"gpt-5.4-mini"`.
>     - `settings_should_round_trip_through_json`: change `engine: "codex".into(),` to
>       `model: "sonnet-5".into(),` (any valid id works; a non-default one exercises the round trip).
>   - The container attribute `#[serde(rename_all = "camelCase", default)]` is unchanged, so a
>     pre-existing `settings.json` with `"engine": "claude-code"` and no `"model"` deserializes
>     cleanly: the unknown `engine` key is ignored and `model` falls back to the default.
> - **Why:** Keeps the Rust struct the source of truth for the on-disk shape, with graceful
>   migration for files written before this change.

> **Step 8 — Seed the model at boot**
>
> - **File:** `src/hooks/use-settings-bootstrap.ts`
> - **Action:** MODIFY
> - **Details:**
>   - Replace the import `import { getBackend } from '@/lib/agent/backend-registry';` with
>     `import { getModel } from '@/lib/agent/model-catalog';` (`getBackend` is no longer used here).
>   - Replace the seeding block:
>     ```ts
>     // Seed the persisted engine choice — the file is hand-editable, so only adopt an
>     // engine the registry knows — but never yank a session the user already started.
>     if (getBackend(settings.engine) && !useChatStore.getState().sessionStarted) {
>       useChatStore.getState().setBackend(settings.engine);
>     }
>     ```
>     with:
>     ```ts
>     // Seed the persisted model choice — the file is hand-editable, so only adopt a model the
>     // catalog knows — but never yank a session the user already started.
>     if (getModel(settings.model) && !useChatStore.getState().sessionStarted) {
>       useChatStore.getState().setModel(settings.model);
>     }
>     ```
>   - The vault-open logic below is unchanged.
> - **Why:** Boot seeds the chat from the persisted model, validated against the catalog so a
>   stale/hand-edited id is ignored (the store keeps `DEFAULT_MODEL_ID`).

> **Step 9 — Replace the "Engine" row with a "Model" row in the Settings dialog**
>
> - **File:** `src/components/layout/SettingsDialog.tsx`
> - **Action:** MODIFY
> - **Details:**
>   - **Imports:** replace `import { listBackends } from '@/lib/agent/backend-registry';` with
>     `import { listModels } from '@/lib/agent/model-catalog';`.
>   - **Selector:** replace `const setBackend = useChatStore((state) => state.setBackend);` with
>     `const setModel = useChatStore((state) => state.setModel);`.
>   - **Doc comment:** in the block comment above `export function SettingsDialog()`, change
>     "editing the four persisted settings (#25) — engine, theme, editor font, vault path —" to
>     "… — model, theme, editor font, vault path —", and "Selecting an engine also switches the
>     chat backend immediately" to "Selecting a model also switches the chat model (and thus its
>     engine) immediately".
>   - **Row markup:** replace the entire `<SettingsRow label="Engine"> … </SettingsRow>` block
>     with:
>     ```tsx
>     <SettingsRow label="Model">
>       <div className="flex flex-wrap justify-end gap-1">
>         {listModels().map((model) => (
>           <button
>             key={model.id}
>             type="button"
>             aria-pressed={model.id === settings.model}
>             onClick={() => {
>               void updateSettings({ model: model.id });
>               setModel(model.id);
>             }}
>           >
>             <Badge tone={model.id === settings.model ? 'plain' : 'muted'}>{model.label}</Badge>
>           </button>
>         ))}
>       </div>
>     </SettingsRow>
>     ```
>     `flex-wrap justify-end` lets the four badges wrap within the 420px dialog while staying
>     right-aligned like the other rows' controls. The Theme/Editor font/Vault rows are unchanged.
> - **Why:** Settings is the single place engines were chosen; it now chooses models, persisting
>   via `updateSettings({ model })` and applying live via `setModel`.

> **Step 10 — Update the domain glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:**
>   1. **Add** two Core-entities rows (near the other agent entities):
>      - `AgentModel` / `AgentModelId` (`src/lib/agent/model-catalog.ts`) — "A user-selectable LLM.
>        `id` is persisted in `Settings.model`; `label` is shown in the Settings model picker;
>        `engine` is the `AgentSource` (CLI) that runs it — **derived from the model, never
>        persisted separately**; `cliModel` is the exact string passed to that CLI's `--model`
>        flag. The four v0 models: GPT 5.4 mini / GPT 5.5 fast (`codex`), Haiku 4.5 / Sonnet 5
>        (`claude-code`)."
>      - Model catalog — `AGENT_MODELS` / `listModels` / `getModel` / `DEFAULT_MODEL_ID`
>        (`src/lib/agent/model-catalog.ts`) — "The static list the Settings picker renders and the
>        chat/boot seed resolve against. `DEFAULT_MODEL_ID` (`gpt-5.4-mini`) mirrors Rust
>        `default_model()`."
>   2. **Update `Settings`** row: `engine` (an `AgentSource`) → `model` (an `AgentModelId`, whose
>      engine is derived from the catalog). Keep the "every field has a serde default so
>      older/hand-edited files still parse" note and add that a pre-`model` file's stale `engine`
>      key is ignored and `model` falls back to `gpt-5.4-mini`.
>   3. **Update `Agent backend`** row: note `start(cwd, model, onEvent)` now takes the model string,
>      which each adapter passes to its CLI's `--model` flag.
>   4. **Update `Chat store`** row: it holds `modelId` (an `AgentModelId`), derives the engine via
>      `getModel(modelId).engine`, looks the backend up with that, and passes the model's `cliModel`
>      to `start`. `setModel` (was `setBackend`) restarts the session on any model change.
>   5. **Update `Settings dialog`** row: "Selecting an engine also calls `useChatStore.setBackend`"
>      → "Selecting a model also calls `useChatStore.setModel` (which switches the derived engine)";
>      "four persisted settings" wording stays accurate (model/theme/font/vault).
>   6. **Update `Settings bootstrap`** row: "seeds `useChatStore`'s engine (only if the registry
>      knows it …)" → "seeds `useChatStore`'s model (only if the catalog knows it …)".
>   7. **Relationships** — update the three lines that name the removed identifiers:
>      - "`useChatStore.sendMessage` … looks the backend up via `getBackend(backendId)` …" →
>        "… resolves the model via `getModel(modelId)`, looks the backend up via
>        `getBackend(model.engine)`, and passes `model.cliModel` to `start` …".
>      - "`ChatPanel` no longer renders a backend selector … which calls `useChatStore.setBackend`
>        … alongside persisting `settings.engine`." → replace `setBackend`→`setModel`,
>        `settings.engine`→`settings.model`, and note the engine is derived from the model.
>      - "`settings.engine` *seeds* `useChatStore.backendId` at boot … via `setBackend` (#29) …" →
>        "`settings.model` *seeds* `useChatStore.modelId` at boot … via `setModel` (#29);
>        `SettingsDialog` is the sole way to switch models — and thus engines, derived from them —
>        so every change is persisted."
>   8. **Flagged ambiguities** — add: "**Engine vs Model.** The *engine* (`AgentSource`:
>      `claude-code`/`codex`) is which CLI is spawned; the *model* (`AgentModel`) is which LLM that
>      CLI runs, via `--model`. The user picks a model; the engine is derived from it and is no
>      longer a standalone setting. Don't persist an engine separately from the model."
>   9. **Changelog** — add a row:
>      `| 2026-07-10 | Added `AgentModel`/`AgentModelId` + model catalog (`src/lib/agent/model-catalog.ts`); `Settings.engine`→`Settings.model`; `AgentBackend.start` gains a `model` arg both backends pass to the CLI `--model` flag; `useChatStore.backendId`/`setBackend`→`modelId`/`setModel` (engine derived); SettingsDialog Engine row → Model row | Settings model selector: the user picks an LLM (GPT 5.4 mini / Haiku 4.5 / Sonnet 5 / GPT 5.5 fast); the engine follows from the model |`
>   10. **Bump "Last updated"** to `2026-07-10` and append a parenthetical: "Settings model
>       selector — `Settings.model` (an `AgentModel`) replaces `Settings.engine`; the engine is
>       derived from the model; `AgentBackend.start` passes `--model`".
> - **Why:** `.agents/rules/domain-glossary.md` mandates the glossary track new entities and
>   changed relationships; several entries and relationships describe the now-removed engine setting.

## Architecture Decisions

- **Model determines engine; engine is not persisted.** A model maps 1:1 to an engine in the
  catalog, so storing `Settings.model` alone is sufficient. Keeping a separate persisted `engine`
  would let the two disagree — the exact ambiguity the prior ChatPanel-selector removal set out to
  kill. Chosen over "add a model field beside engine".
- **`model` as a `start` parameter, not a new backend method or a store the backend reads.** The
  model is immutable for a session (a change restarts it), so it rides alongside `cwd`. This keeps
  backends decoupled from Zustand (the existing invariant: only `AgentEvent` crosses the boundary).
- **Any model change restarts the session — even within one engine.** `--model` is fixed in the
  spawn args at `start`, so switching Haiku 4.5 → Sonnet 5 (both Claude Code) must stop and re-start
  the process. `setModel` therefore resets `sessionStarted` on every change, not just engine changes.
- **Graceful settings migration via existing serde defaults.** `#[serde(default)]` + serde's
  ignore-unknown-fields means an old `settings.json` (`engine` present, `model` absent) loads with
  `model = "gpt-5.4-mini"` and the stale `engine` ignored. No migration code needed.
- **Default model is `gpt-5.4-mini` (engine `codex`) — chosen by the user.** This changes the
  default engine from `claude-code` to `codex`. Codex is not installed on this dev machine (epic
  Open Questions), so a **fresh-install first chat will surface `CommandNotFound`** (the existing
  `agent_spawn` error path) until the user installs Codex or switches to a Claude model in Settings.
  This is an accepted consequence of the default choice, not a regression to fix here. Flipping the
  default to a Claude model is a one-word change in **two** places: `DEFAULT_MODEL_ID` and Rust
  `default_model()` (they must stay equal).
- **Catalog is a static file, not fetched.** The four models are hard-coded; adding/removing a
  model is a one-line edit to `AGENT_MODELS`. Matches the codebase's static, no-network posture.
- **`AGENT_MODELS` and the `AgentModelId` union are kept in sync by hand.** Mirrors how
  `AgentSource` and the backend registry already coexist; an explicit union reads better than a
  `typeof`-derived one and matches house style.

## Validation Criteria

- [ ] `pnpm build` passes — `tsc` reports no type errors (notably: `Settings.model` typed as
      `AgentModelId`; `chat-store` has no dangling `AgentSource`/`backendId`; both backends match
      the new `start` signature; `SettingsDialog`/`use-settings-bootstrap` compile).
- [ ] `pnpm lint` passes — Biome flags no unused imports/vars (`AgentSource` dropped from
      `chat-store`/`settings.service`; `getBackend` dropped from `use-settings-bootstrap`;
      `listBackends` no longer imported by `SettingsDialog`; `CODEX_BASE_ARGS` removed).
- [ ] `pnpm check` passes (lint + format).
- [ ] `cargo test` in `src-tauri/` passes the two updated `settings` tests (optional — no CI runner
      configured, but the tests exist).
- [ ] Manual smoke test (`pnpm dev`):
  - [ ] Open Settings (`Ctrl-w s`). The row is labelled **Model** and shows four badges: GPT 5.4
        mini, Haiku 4.5, Sonnet 5, GPT 5.5 fast. No Claude Code / Codex engine buttons remain.
  - [ ] The currently-persisted model's badge is `plain` (selected); the rest are `muted`.
  - [ ] Select **Haiku 4.5**, send a chat message — the Claude Code process is spawned with
        `--model claude-haiku-4-5-20251001` (confirm in `logs/orbit-111.log` / process args or by
        the reply). Select **GPT 5.5 fast** and confirm a Codex process is spawned instead.
  - [ ] Switch model mid-session (e.g. Sonnet 5 → Haiku 4.5): the next message restarts the
        session cleanly (no crash, no leaked old process).
  - [ ] Restart the app — the last-selected model is still selected (persisted to `settings.json`).
  - [ ] An `settings.json` still containing `"engine": "claude-code"` and no `"model"` opens
        without error and defaults to **GPT 5.4 mini**.
  - [ ] Fresh install (no `settings.json`) defaults to GPT 5.4 mini; if Codex isn't installed, the
        first chat send surfaces the existing `CommandNotFound` error — switching to Haiku 4.5 or
        Sonnet 5 in Settings then chats normally.

## Open Questions

- **Exact CLI `--model` strings (resolved: use placeholders).** The Claude values
  (`claude-haiku-4-5-20251001`, `claude-sonnet-5`) come from known model ids and Claude Code's
  `--model` accepting full ids (aliases `haiku`/`sonnet` are a fallback if a full id is rejected).
  The **Codex** values (`gpt-5.4-mini`, `gpt-5.5-fast`) are best-effort slugs — Codex is not
  installed on this machine and these are near-future model names, so the exact strings
  `codex exec --model` accepts are unverified. Per the user's decision, ship these placeholders and
  adjust the two `cliModel` values in `AGENT_MODELS` later if a CLI rejects them; nothing else in
  the plan changes.
- **Default model (resolved: GPT 5.4 mini).** The user chose `gpt-5.4-mini` as the default. Its
  engine is `codex` — see the Architecture Decision on the fresh-install `CommandNotFound`
  consequence when Codex isn't installed.
