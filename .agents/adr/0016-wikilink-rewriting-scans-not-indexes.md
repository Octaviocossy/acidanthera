# Wikilink rewriting scans the vault; it does not index it

Renaming a note breaks every `[[wikilink]]` pointing at it, because a wikilink target is the
note's basename without `.md` and nothing else (`src-tauri/templates/vault-agents.md`). Rather
than build the in-memory link index `doc/v0-spec.md` §5.4 reserves for the post-v0 graph view, a
rename scans the vault's Markdown once, in Rust, at the moment it happens — no cache, no watcher
coupling, nothing to invalidate. The index is the right structure for backlinks and a graph; it
is the wrong price for an operation a user performs a few times a day.

Two consequences are deliberate. Ambiguity is refused rather than guessed: if two notes share the
old basename the rewrite is skipped entirely and the user is told, because the link model has no
way to express which one a link meant. And the rename is never rolled back — it lands first, the
rewrite is best-effort after it, and failures are reported, since a renamed note with stale links
is a smaller problem than a rename that silently un-happens.

## Consequences

- The first multi-file read in the app's own process. Every previous vault-wide search was
  delegated to the agent CLI's `Grep`.
- Deletion still breaks links silently. That is unchanged and out of scope; the scanner makes
  adding a warning there a one-line change if it is ever wanted.
