# The rebrand reaches the on-disk chat format

The rename from `orbit-111` to `acidanthera` was taken all the way down, including the two
on-disk namespaces inside a user's vault: `.orbit/chats/` became `.acidanthera/chats/`, and the
`<!-- orbit:chat … -->` item markers that `chat-file.ts`'s `MARKER_RE` matches became
`<!-- acidanthera:chat … -->`. Leaving them was the recommendation — they are a serialized
format contract rather than branding — and was rejected in favour of a name that is consistent
everywhere, on the grounds that nothing has shipped and the total affected population was six
files on one machine.

No back-compat was built: `parseChatFile` reads only the new marker and `chats.rs` only the new
directory. The existing files were migrated once, by hand, with `mv` and `sed`.

## Consequences

A chat file written before the rebrand parses as an **empty transcript**, not an error —
`parseChatFile` simply finds no markers. The failure is therefore silent, which is why the
one-time migration is mandatory rather than best-effort.

Reversing this decision, or supporting a vault that predates it, means writing the migration or
dual-read that was deliberately skipped here. `CHAT_FILE_SCHEMA` is the versioning hook where
that would belong.
