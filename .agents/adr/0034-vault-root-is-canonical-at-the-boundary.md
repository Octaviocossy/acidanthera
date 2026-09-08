# The vault root is canonicalized at the adopt boundary, not per call

`open_vault` canonicalized the root it stored (via `prepare_vault_root`) while `pick_vault`
stored the picked folder verbatim, so `VaultState.root` was canonical on one adopt path and not
the other — which is why `guarded_path` re-canonicalized its root on every call, and why
`rename_entry_in`, `duplicate_entry_in` and `delete_entry_in` each canonicalized it a *second*
time for their `path == root` check. Both adopt paths now canonicalize before storing, so the
root is canonical by construction and `guarded_path` canonicalizes only its target.

We chose one boundary establishing the invariant over every call site re-deriving it
defensively. The rejected alternative — leaving the split and merely hoisting the redundant
canonicalization out of the hot loops — keeps a state where the same folder yields two
different strings to the frontend depending on how it was opened, which is a correctness
problem independent of the syscall cost that surfaced it.

## Consequences

A folder adopted through a symlink now displays and persists resolved (`/tmp/brain` becomes
`/private/tmp/brain` on macOS), because `pick_vault` returns the canonical path the way
`open_vault` always has. This is the intended normalization, but it is user-visible in the
sidebar footer, the settings dialog, and the persisted `vaultPath`.

Containment itself is unchanged: `guarded_path` still canonicalizes every target and still
rejects leaf symlinks, and trusted-source paths still route through it rather than being read
directly (see `.agents/ubiquitous-language.md` invariant 4).
