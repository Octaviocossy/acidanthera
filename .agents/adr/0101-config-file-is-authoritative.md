# The config file is authoritative, and the Settings dialog is a typed editor of it

Orbit's settings become a user-editable `settings.toml`, and that file — not an internal store — is
the single source of truth. The Settings dialog is kept, but demoted: it now reads and writes that
same file rather than owning the state. The alternative of deleting the dialog was rejected because
two of its four rows do something text cannot — the model row *enumerates* the four valid model
ids, and the vault row opens a native folder picker — and the alternative of letting the dialog keep
its own store was rejected outright as two sources of truth that would drift.

## Consequences

Two writers on a file whose comments belong to the user is what forces most of the rest of the
design. Programmatic writes must preserve comments and key ordering, which is why `toml_edit` is a
dependency rather than plain `toml`. The dialog must observe external edits, which is why there is a
second filesystem watcher on the app config dir emitting `config-changed` (the existing watcher is
vault-only, and reusing `vault-changed` would trigger a full tree reload on every config save). The
dialog's own writes come back through that watcher into the store it renders from, so echo
suppression and debounce are mandatory, not polish.

The sharpest consequence: **the dialog disables its controls while the file has a parse error.**
`toml_edit` cannot parse a broken file, so a dialog that still wrote would have to regenerate from
the last-good copy in memory — destroying whatever the user was mid-way through typing. Refusing to
write, and showing the parse error with its line number instead, is the only behavior consistent
with the rule that the app never rewrites the user's file.

> Raised by: `/grill`, 2026-08-07. See
> `.agents/specs/2026-08-07-user-editable-config-files.md` (decisions 2, 5, 6, 10).
