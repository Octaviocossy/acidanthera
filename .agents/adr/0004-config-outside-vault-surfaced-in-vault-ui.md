# Config files live outside the vault but are surfaced inside vault-scoped UI

`settings.toml`/`keymaps.toml` stay in the platform config directory, never under the vault
root — vault filesystem operations (`src-tauri/src/vault.rs`) must stay strictly contained to
the vault they guard, and config already has its own isolated, allowlisted command layer (#95).
But the sidebar file tree and the fuzzy finder are the two places a user actually looks for
open-and-edit affordances, so config files are surfaced there anyway, as an explicit second
source (`ConfigEntry`/`CONFIG_ENTRIES`, `src/lib/config/config-entries.ts`) — never injected
into the real vault tree (`sidebar.tree`) or into `VaultFileCandidate`'s vault-root-scoped
collection. This gives the two allowlisted config files the same open/edit/save experience as a
vault note without weakening the vault's containment guarantee or `build_tree`'s single
Markdown-only check (`vault.rs:273`), at the cost of two small, deliberate contract exceptions a
future reader should not "fix": a sidebar row `build_tree` never produced, and a finder candidate
that bypasses the finder's own vault-root prefix filter.
