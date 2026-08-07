# The keymaps file is command-keyed, not chord-keyed

`keymaps.toml` maps **command → list of chords**, the inverse of how nearly every editor's keymap
file is written:

```toml
[global]
"global.find-file" = ["ctrl-p"]   # replaces the default ctrl-w f
"global.toggle-chat" = []         # unbound
```

The obvious chord-keyed form (`"ctrl-p" = "global.find-file"`) was the first choice and was
reversed, because it cannot express what the file exists to do.

## Considered Options

**Chord-keyed with overrides-only merging** — rejected. Defaults live in code and the file holds
only changes, so merging `{"ctrl-p" = "global.find-file"}` over the defaults yields *both* chords
live. The user has aliased, not rebound, and there is no way to say "`ctrl-w f` no longer does
anything" — deleting a line they never wrote does nothing. It also breaks the lockout guard, which
must detect a modal left with no dismiss binding: a state the format could not produce.

**Chord-keyed plus an unbind sentinel** (`"ctrl-w f" = false`) — rejected as second-best. It works,
but moving one binding takes two lines, and it leaves the discoverability half unsolved: a file
seeded with default *chords* never names the commands that have no default chord, so those stay
findable only by reading the source.

**Command-keyed** — chosen. Unbind is `[]`, rebind is one line replacing that command's chords
wholesale, and the seeded file is a **complete command catalog by construction** — every command
appears, unbound ones as empty lists. Uncommenting a seeded line and editing it does exactly what
it looks like it does.

## Consequences

Inverting the map makes duplicate chords expressible, where TOML's duplicate-key rule previously
made them impossible. Two commands can claim `ctrl-p`, so conflict resolution is now a required
piece of the loader: first entry in file order wins, the later command loses that one chord, and a
toast names both — the same per-key degradation used for bad values and unknown command ids.

> Raised by: `/grill`, 2026-08-07. See
> `.agents/specs/2026-08-07-user-editable-config-files.md` (decisions 7, 9, 20, 22).
