# Plan: Chat persistence — `.orbit/chats` Rust store & service

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #68 (epic #66 — chat management & history)

## Goal

Give epic #66 a durable **storage layer** for saved conversations: a format-agnostic Rust
store that moves serialized chat-file bytes to/from a hidden `.orbit/chats/` directory inside
the open vault, plus a typed TS service wrapping it. This is the persistence slice that sits
between the #67 format contract (`src/lib/chat/chat-file.ts`) and the later save/load-loop and
history-list UI slices — it owns **where/when** a chat is written, never the file's *shape*.

## Context

- **What exists today:**
  - The chat transcript lives only in memory as `useChatStore.items` (`ChatItem[]`,
    `src/stores/chat-store.ts`); nothing persists it.
  - #67 landed the pure format contract `src/lib/chat/chat-file.ts` — `ChatFile`/`ChatFileMeta`,
    `CHAT_FILE_EXTENSION = '.chat.md'`, and the round-trippable `serializeChatFile`/`parseChatFile`
    codec — but no code writes those bytes anywhere.
  - The Rust vault backend (`src-tauri/src/vault.rs`) owns the open vault root in a
    `tauri::State` (`VaultState`) and exposes guarded `read_note`/`write_note`/`create_note`.
    Its `build_tree` **skips every dot-prefixed entry** (`.git`, `.obsidian`, …), so anything
    under `.orbit/` is automatically hidden from the sidebar.
  - Backend command idioms are settled: `thiserror` enums that `Serialize` to their `Display`
    string, the `(|| { … })().log_err("cmd")` wrapper (`src-tauri/src/logging.rs`), and
    `#[serde(rename_all = "camelCase")]` on returned structs.
  - TS services are thin `invoke` wrappers: `src/services/{vault,settings,agent-process}.service.ts`.
- **What prompted this:** epic #66 (chat management & history). The format contract is done;
  this is the next foundation slice — persistence — that the save/load loop and history UI consume.
- **Constraints / decisions:**
  - **Format-agnostic store.** The Rust store must **not** parse the chat-file format — that
    contract lives in `chat-file.ts` (TS). Rust stores/reads/lists/deletes raw markdown strings
    keyed by a chat `id`. The `.chat.md` suffix is mirrored as a Rust constant (unavoidable
    cross-language duplication, exactly like `settings.rs`'s `default_model()` mirroring
    `DEFAULT_MODEL_ID`) with a test pinning the value.
  - **Hidden storage.** Chats live under `<vault>/.orbit/chats/`. The dot-prefix means
    `build_tree` already hides them — no sidebar change needed.
  - **Root from `VaultState`.** Chat commands derive the vault root from the existing
    `VaultState` (like `read_note`/`write_note`), not from a frontend-passed path, so storage
    stays consistent with the rest of the vault commands. This needs a small public accessor on
    `VaultState`.
  - **`id` is a bare filename stem**, never a path — validated (no separators, no `.`/`..`)
    exactly like `createVaultEntry`'s "a name, never a path" rule, so it can't escape the dir.
  - **No test runner on the TS side** (`AGENTS.md` › Commands); correctness on the Rust side is
    covered by `cargo test` (mirroring `vault.rs`'s test module), and the whole slice by
    `pnpm lint` + `pnpm build`.
  - **Naming.** The persistence service is `chatsService` (`src/services/chats.service.ts`),
    deliberately distinct from the in-memory Zustand `useChatStore` transcript so "chat store"
    never means two things. The Rust module is `chats.rs` (domain noun, parallel to `vault.rs`).

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src-tauri/src/chats.rs` | Format-agnostic chat store: `ChatRecord`, `ChatStoreError`, `save_chat`/`read_chat`/`list_chats`/`delete_chat` commands + unit tests |
| MODIFY | `src-tauri/src/vault.rs` | Add `pub fn root(&self) -> Option<PathBuf>` accessor on `VaultState` |
| MODIFY | `src-tauri/src/lib.rs` | `mod chats;` + register the four commands in `invoke_handler` |
| CREATE | `src/services/chats.service.ts` | `chatsService` typed wrapper + `ChatRecord` interface mirroring the Rust struct |
| MODIFY | `.agents/ubiquitous-language.md` | Register the new entities/relationships; bump "Last updated"; add a Changelog row |
| CREATE | `.agents/plans/2026-07-10-chat-persistence-orbit-store.md` | This plan |

## Step-by-Step Implementation

1. **Add the vault-root accessor** — `src-tauri/src/vault.rs`.
   - Add `impl VaultState { pub fn root(&self) -> Option<PathBuf> { lock(self).root.clone() } }`.
   - **Why:** lets a sibling store resolve paths against the same open-vault root without
     exposing `VaultInner`/`lock` (they stay private).

2. **Create the Rust store** — `src-tauri/src/chats.rs`.
   - Constants: `CHATS_DIR: [&str; 2] = [".orbit", "chats"]`, `CHAT_FILE_EXTENSION: &str = ".chat.md"`
     (mirrors `chat-file.ts`; a test pins it).
   - `ChatRecord` (`#[derive(Serialize)]`, `#[serde(rename_all = "camelCase")]`):
     `{ id: String, path: String, updated_ms: u64, contents: String }` — `updated_ms` is the
     filesystem mtime in ms; `contents` is raw chat-file markdown parsed on the TS side.
   - `ChatStoreError` (`thiserror`): `NoVaultOpen`, `InvalidId`, `NotFound`, `Io(#[from] io::Error)`;
     manual `Serialize` → `to_string()` (same shape as `VaultError`). `type ChatStoreResult<T>`.
   - Helpers: `chats_root(root)` (`root/.orbit/chats`), `is_safe_id(id)` (non-empty, not `.`/`..`,
     no `/`\`\`\`\0`), `chat_path(root, id)` (guards id → `chats_root/<id>.chat.md`),
     `current_root(&VaultState)` (via `vault.root()`), `mtime_ms(path)`.
   - Pure inner fns (testable without Tauri): `save_chat_in` (`create_dir_all` + `fs::write`,
     returns path), `read_chat_in` (`NotFound` on missing), `delete_chat_in` (`NotFound` on
     missing), `list_chats_in` (missing dir → `[]`; keep only `*.chat.md` files; strip suffix →
     id; read contents; sort newest-first by `updated_ms`, tie-break by id asc).
   - Four `#[tauri::command]`s (`save_chat`/`read_chat`/`list_chats`/`delete_chat`), each an
     `info!` log + `(|| { … })().log_err("cmd")` wrapper delegating to the inner fn.
   - `#[cfg(test)]` module mirroring `vault.rs` (temp-root helper): save→read round-trip, save
     creates `.orbit/chats`, list empty when dir missing, list sorted + ignores non-chat files,
     read/delete missing → `NotFound`, invalid id rejected, `is_safe_id`/extension-constant units.

3. **Wire it up** — `src-tauri/src/lib.rs`: add `mod chats;` and the four
   `chats::save_chat, chats::read_chat, chats::list_chats, chats::delete_chat` handlers. No new
   `.manage()` — the store is stateless, deriving its root from the already-managed `VaultState`.

4. **Create the TS service** — `src/services/chats.service.ts`.
   - `export interface ChatRecord { id: string; path: string; updatedMs: number; contents: string }`
     (mirrors the Rust `ChatRecord`; `contents` is raw markdown → parse with `parseChatFile`).
   - `export const chatsService = { saveChat(id, contents) → Promise<string>,
     readChat(id) → Promise<string>, listChats() → Promise<ChatRecord[]>,
     deleteChat(id) → Promise<void> }`, each a single `invoke('…', { … })`.

5. **Update `.agents/ubiquitous-language.md`** — add `Chat record`, the `.orbit/chats` chat store,
   and `chatsService` to Core entities; add Relationships (root from `VaultState`, hidden via the
   dot-prefix, format parsed on the TS side); bump "Last updated"; append a Changelog row.

## Architecture Decisions

- **Format-agnostic Rust store.** Keeps the single source of truth for the chat-file *shape* in
  `chat-file.ts` (TS) — Rust only moves bytes. Mirrors how `vault.rs` reads/writes note strings
  without parsing markdown. The one unavoidable cross-language duplication (`.chat.md`) is
  pinned by a test, the same tactic `settings.rs` uses for its mirrored TS defaults.
- **`list_chats` returns `contents`.** A history list needs every chat's title/model, which only
  the TS parser can extract — so every file must be read regardless. Returning contents in the
  one list call is a single IPC round-trip instead of `1 + N`, and parsing still happens in TS.
- **Root from `VaultState`, id is a bare name.** Storage stays consistent with `read_note`/
  `write_note` (guarded, root-derived), and a validated bare id can't traverse out of
  `.orbit/chats/` — the same guard discipline as `guarded_path`/`createVaultEntry`.
- **Hidden by the existing dot-prefix rule.** No `build_tree` change: `.orbit/` is skipped like
  `.git`/`.obsidian`, so saved chats never clutter the sidebar (they stay readable by path).
- **Additive.** No existing command or type changes behavior; the only edit to a shared file is a
  new public accessor + module registration — conflict-safe against epic siblings.

## Validation Criteria

- [x] `cargo test` (in `src-tauri/`) passes, including the new `chats` tests (32 total: 22 prior + 10 new); `cargo clippy --all-targets` is clean.
- [x] `pnpm build` (tsc + Vite) passes — the new service typechecks.
- [x] `pnpm lint` (Biome) passes (76 files, no issues).
- [x] `save_chat` → `read_chat` round-trips a serialized chat verbatim; `list_chats` returns it
      newest-first with correct `id`/`contents`; `delete_chat` removes it; missing id → `NotFound`
      (covered by the `chats.rs` test module).
- [x] Chat files land under `<vault>/.orbit/chats/` (test asserts the resolved path) and are hidden
      from `read_vault_tree` for free by `build_tree`'s dot-prefix skip — no `build_tree` change.
- [x] Ubiquitous-language glossary updated + "Last updated" bumped + Changelog row added.

## Open Questions

None. The save-on-turn loop, resume/load, and the history-list UI are deliberately out of scope —
they are later epic-#66 slices that consume this store + the #67 format contract.
