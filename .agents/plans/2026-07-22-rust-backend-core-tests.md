# Plan: Rust Backend Core Tests

> Status: **completed**
> Created: 2026-07-22
> Updated: 2026-07-22

## Goal

Add high-value Rust unit tests for backend persistence, serialization, errors, and filesystem containment. Fix the vault and chat symlink vulnerabilities exposed by those tests.

## Context

- The backend currently has 47 passing unit tests.
- Coverage is strongest around vault creation, chat CRUD, and agent command discovery.
- Vault note access can follow a leaf symlink outside the vault.
- Chat persistence can follow `.orbit`, `chats`, or chat-file symlinks outside the vault.
- Settings serialization is tested, but actual file persistence is not.
- The selected scope is security and core behavior; Windows-only command resolution is deferred.
- Tests remain co-located and use only the standard library.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `.agents/plans/2026-07-22-rust-backend-core-tests.md` | Persist and track this implementation plan |
| MODIFY | `src-tauri/src/vault.rs` | Harden vault containment and add unit-testable helpers and tests |
| MODIFY | `src-tauri/src/chats.rs` | Harden chat storage containment and add core tests |
| MODIFY | `src-tauri/src/settings.rs` | Extract file-based persistence helpers and test them |
| MODIFY | `.agents/ubiquitous-language.md` | Document strengthened filesystem containment |

No dependencies or separate test files will be added.

## Step-by-Step Implementation

1. **Persist the plan**
   - **File:** `.agents/plans/2026-07-22-rust-backend-core-tests.md`
   - **Action:** CREATE
   - **Details:** Save this approved plan with status `in-progress` when implementation starts.
   - **Why:** Keeps the cross-agent workflow synchronized.

2. **Harden vault path resolution**
   - **File:** `src-tauri/src/vault.rs`
   - **Action:** MODIFY
   - **Details:** Update `guarded_path` to canonicalize the vault root; reject existing leaf symlinks; canonicalize existing regular targets and validate they remain under the root; and validate the canonical parent for nonexistent targets. Update `build_tree_at` to include only real files and directories, excluding symlinks.
   - **Why:** Prevents note reads and writes from escaping through symlinks.

3. **Extract testable vault helpers**
   - **File:** `src-tauri/src/vault.rs`
   - **Action:** MODIFY
   - **Details:** Add private helpers:

     ```rust
     fn prepare_vault_root(path: &Path) -> VaultResult<PathBuf>;
     fn read_note_in(root: &Path, target: &str) -> VaultResult<String>;
     fn write_note_in(root: &Path, target: &str, contents: &str) -> VaultResult<()>;
     ```

     Keep Tauri commands as thin wrappers that resolve managed state and delegate.
   - **Why:** Tests filesystem behavior without constructing a Tauri runtime.

4. **Add vault tests**
   - **File:** `src-tauri/src/vault.rs`
   - **Action:** MODIFY
   - **Details:** Cover root preparation, default-state errors, note read/write behavior, outside paths, parent and leaf symlinks on Unix, tree symlink filtering, deterministic sorting, creation validation, `VaultEntry` camelCase serialization, and stable `VaultError` serialization.
   - **Why:** Covers containment, domain errors, ordering, and the Rust-to-TypeScript IPC contract.

5. **Harden chat storage**
   - **File:** `src-tauri/src/chats.rs`
   - **Action:** MODIFY
   - **Details:** Add `ChatStoreError::PathEscapesRoot`. Validate `.orbit` and `.orbit/chats` component by component against the canonical vault root; reject symlinked storage components and leaf files; preserve missing-directory behavior for reads and lists; use `DirEntry::file_type()?.is_file()` for listing; and filter unsafe discovered IDs.
   - **Why:** Prevents chat CRUD from reading or writing outside the open vault.

6. **Add chat tests**
   - **File:** `src-tauri/src/chats.rs`
   - **Action:** MODIFY
   - **Details:** Cover storage and leaf symlinks on Unix, unchanged outside targets after rejected writes, listing filters, unsafe on-disk IDs, equal-mtime ordering, regular-file storage conflicts, `ChatRecord` serialization, and stable `ChatStoreError` serialization.
   - **Why:** Pins storage safety, filtering, ordering, error mapping, and IPC behavior.

7. **Extract settings persistence helpers**
   - **File:** `src-tauri/src/settings.rs`
   - **Action:** MODIFY
   - **Details:** Add:

     ```rust
     fn read_settings_from(file: &Path) -> SettingsResult<Settings>;
     fn resolve_default_vault_path(settings: &mut Settings, default_path: &str);
     fn write_settings_to(file: &Path, settings: &Settings) -> SettingsResult<()>;
     ```

     Missing files return defaults; invalid JSON remains a typed error; writes create the parent and use pretty camelCase JSON. Commands resolve platform paths and delegate.
   - **Why:** Separates platform lookup from deterministic persistence behavior.

8. **Add settings tests**
   - **File:** `src-tauri/src/settings.rs`
   - **Action:** MODIFY
   - **Details:** Cover missing files, invalid JSON, default vault-path resolution, nonempty vault-path preservation, parent creation, overwrites, pretty camelCase output, frontend serialization, missing-field defaults, legacy `engine` compatibility, and stable error serialization.
   - **Why:** Covers the persisted settings contract rather than serde alone.

9. **Update domain documentation**
   - **File:** `.agents/ubiquitous-language.md`
   - **Action:** MODIFY
   - **Details:** Update the Vault and chat-persistence entries to state that symlinked protected files and storage components are rejected or hidden. Bump `Last updated` and add a changelog row.
   - **Why:** Filesystem containment is shipped domain behavior.

10. **Verify and complete**
    - **File:** `.agents/plans/2026-07-22-rust-backend-core-tests.md`
    - **Action:** MODIFY
    - **Details:** Run focused suites:

      ```bash
      cargo test --manifest-path src-tauri/Cargo.toml vault::tests
      cargo test --manifest-path src-tauri/Cargo.toml chats::tests
      cargo test --manifest-path src-tauri/Cargo.toml settings::tests
      ```

      Then run:

      ```bash
      cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
      cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
      cargo test --manifest-path src-tauri/Cargo.toml
      pnpm test
      ```

      Mark the plan `completed` after all checks pass.
    - **Why:** Confirms the hardened backend and unchanged frontend remain valid.

## Architecture Decisions

- Reject protected symlinks entirely instead of allowing symlinks whose current destination happens to remain inside the vault.
- Keep Tauri commands thin and test private helpers with explicit paths.
- Use typed errors and `matches!`, avoiding assertions against platform-specific OS messages.
- Use standard-library temporary directories; do not add `tempfile`, mocks, snapshots, or property-testing dependencies.
- Do not unit-test native dialogs, watchers, real child processes, Tauri event delivery, logging output, or application startup.
- Defer Windows `PATHEXT` command-discovery behavior to a separate cross-platform task.
- Standard-library path validation reduces accidental traversal but does not eliminate hostile time-of-check/time-of-use filesystem races.

## Validation Criteria

- [x] Vault reads and writes cannot follow protected symlinks.
- [x] The vault tree excludes symlinked entries.
- [x] Chat CRUD cannot follow storage or leaf symlinks.
- [x] Chat listing excludes unsafe, non-file, and symlinked entries.
- [x] Settings persistence is covered without a Tauri runtime.
- [x] Rust-to-TypeScript serialization contracts are pinned.
- [x] Existing 47 Rust tests continue to pass (79 total).
- [x] New focused Rust tests pass.
- [x] Cargo formatting and Clippy pass.
- [x] Frontend tests remain green (145 tests).
- [x] No new dependencies are introduced.
- [x] Domain documentation reflects the hardened behavior.

## Open Questions

None.
