# Config files live outside the vault but are surfaced inside vault-scoped UI

`settings.toml` and `keymaps.toml` live in the app config dir, not in the vault, because settings
are app-global — a font or theme preference should not change when you switch vaults, and a
`vaultPath` stored inside the vault it points at is circular. But the requirement was that they be
found through the fuzzy finder and edited in orbit's own editor, and both of those surfaces are
vault-scoped. So the files are injected into them deliberately, as documented exceptions.

## Consequences

Two otherwise-strict contracts get explicit exceptions, and a reader who finds either one without
this context will reasonably think it is a bug:

- ~~The sidebar renders a **Config section whose rows `build_tree` never produced**. They are not
  injected into `useSidebarStore.tree` — `Sidebar.tsx` replaces that wholesale on every
  `vault-changed`, which would erase them — but concatenated into the flattened row list, so the
  cursor and keymap must tolerate a row with no vault path, and `a`/`A` drafts need a vault-only
  guard.~~ **Superseded by ADR 0010 (2026-08-08):** the Config section was removed from the sidebar
  and the second row source deleted with it. The finder is now config's only entry point.
- The finder lists **candidates that fail its own vault-root prefix check** at `file-search.ts:26`.
  They come from a separate source and carry a `source` field so selection can route away from
  `openVaultFile`.

The path guard itself is not weakened. `guarded_path` still rejects everything outside the vault
root; config files are reached through separate Tauri commands with an explicit two-filename
allowlist and the same canonicalize/symlink-reject discipline. This is why `EditorBuffer` carries
`source: 'vault' | 'config'` — save routing must be decided by a type, not by sniffing the path at
each call site.

> Raised by: `/grill`, 2026-08-07. See
> `.agents/specs/2026-08-07-user-editable-config-files.md` (decisions 1, 8, 11).
