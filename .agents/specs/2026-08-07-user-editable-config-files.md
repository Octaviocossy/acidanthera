# Spec: User-Editable Config Files (settings + keymaps)

> Status: **settled**
> Created: 2026-08-07
> Grilled: 2026-08-07 — 7 rounds, 24 decisions
> Suggested next: /spec-breakdown

## Goal

Give the user two TOML files — an app-settings file carrying everything the Settings dialog
exposes, and a keymaps file that actually rebinds the app — editable in orbit's own editor and
reachable through the fuzzy finder.

## Context

Settings are reachable only through a four-row modal dialog, and keybindings are not configurable
at all: every chord is hardcoded across six layers and `AppCommandId` (`src/lib/app-command.ts:3`)
has exactly one member, `'find-file'`. A vim-centric editor whose keys cannot be remapped is the
gap this closes.

The design tension that drove most of the interrogation: **the finder is vault-scoped, settings are
app-scoped.** `collectVaultFiles` (`src/lib/vault/file-search.ts:11`) reads only
`useSidebarStore.tree`, which comes from `build_tree_at` (`src-tauri/src/vault.rs:242`) — dot-files,
symlinks and everything that is not `.md` are dropped — and `guarded_path` (`vault.rs:92`) rejects
any path outside the vault root. Config files cannot ride the existing path; they must be injected
deliberately at every surface.

## Settled Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | Where the files live | App config dir (`~/Library/Application Support/com.ovct.orbit-111/`), injected into vault-scoped UI | Settings stay app-global, `vaultPath` stays non-circular, the vault's `.md`-only tree invariant is never breached |
| 2 | Ownership | File is the single source of truth; the Settings dialog becomes a typed editor **of that file** | Keeps the model picker's enumeration and the native folder picker — the two things text cannot replace |
| 3 | Keymaps purpose | Live rebinding, not generated documentation | A reference file is not configuration |
| 4 | Settings scope | Exactly the four dialog rows: `model`, `editorFont`, `theme`, `vaultPath`; unknown keys tolerated | Widening later is additive; the work is the round-trip, not the key count |
| 5 | Format | TOML for both files (`toml` + `toml_edit`) | Comments are the point — the file must document its own valid values |
| 6 | Apply timing | Live on save, both files, via a watcher on the config dir | Matches the dialog, which already flips theme and font instantly |
| 7 | Keymap model | Overrides-only; defaults live in code, merged at load; file seeded with all defaults commented out | Self-documenting without the user owning a frozen copy of upstream defaults |
| 8 | Discovery | Fuzzy finder **and** a sidebar Config section, pinned at the bottom and folded by default | — |
| 9 | Keymap schema | TOML table per layer: `[global]`, `[sidebar]`, `[chat.history]`, `[modal]`, `[editor.normal]`, `[editor.visual]` | Each maps one-to-one onto a boundary that already exists hard in the code |
| 10 | Invalid input | Never rewrite the user's file. Syntax error → reject file, keep last-good, toast with line. Bad value / unknown id → that key falls back to default, toast names it | One bad line costs one binding, not the file |
| 11 | Buffer identity | `EditorBuffer` (and `EditorSaveRequest`) gain `source: 'vault' \| 'config'` | One field answers save routing, language selection and wikilink suppression; the type makes a mis-routed save impossible |
| 12 | Disk-vs-buffer conflict | A disk change never clobbers a dirty buffer — it applies to the app, the buffer keeps user text, toast | Extends existing invariant 6 rather than adding a second rule |
| 13 | Vim depth | Only orbit's **own** editor bindings are rebindable: `editor.save` (`mod-s`), `editor.system-yank` (`y`), the six `Ctrl-w` region-exit chords. Core vim motions stay owned by `@replit/codemirror-vim` | Complete without orbit becoming a second vim config layer over one that already exists |
| 14 | Command surface | Every action dispatched **outside a focused text input**, plus a `[modal]` dismiss table. In-input Enter/Escape (ChatInput submit, FileFinder accept, EntryDraftRow commit, CommandBar) stay hardcoded | **Supersedes an earlier "everything, including modal handlers" answer.** In-input keys fire inside a focused `<input>` where every existing layer bails on `isEditableTarget`; supporting them needs a second, component-scoped dispatch path with its own precedence rules — different in kind, roughly a slice of extra work |
| 15 | Lockout guard | Each modal declares a dismiss command; a config leaving one unbound falls that key back to default + toast | Honors "everything bindable" without a trapdoor; same per-cause degradation as #10 |
| 16 | Migration | First run: if `settings.toml` absent, read `settings.json`, write TOML (atomic temp+rename) with those values plus commented docs, then delete the JSON | One settings file on disk, no ambiguity about which is live |
| 17 | Chord syntax | CodeMirror hyphenated notation — `"ctrl-w f"`, `"mod-s"`; `mod-` = Cmd on macOS, Ctrl elsewhere; spaces separate a sequence | Already the project's notation (`src/lib/editor/save.ts:16`); handles the platform split natively |
| 18 | Command ids | Fully-qualified dotted, kebab within segments — `global.find-file`, `sidebar.cursor-down`, `editor.system-yank` | Globally unique, so an id in a toast is unambiguous and a command is bindable from any section. Renames the existing bare `'find-file'` |
| 19 | Highlighting | TOML via `@codemirror/legacy-modes` `StreamLanguage` for config buffers | Real highlighting for the commented defaults that make the file self-documenting |
| 20 | Unbind / discoverability | **Inverted schema**: each entry is `command = [chords]`. Unbind is `[]`, rebind is one line, and the seeded file is a complete command catalog by construction — unbound commands appear as empty lists | **Supersedes the chord-keyed form of #9.** Overrides-only merging over a chord-keyed map can only ADD, so rebinding was impossible (you could alias, never replace) and commands with no default chord were undiscoverable from the file |
| 21 | Vault switch | `vaultPath` applies fully live: the vault re-opens and **all buffers close**, with one consolidated Save all / Discard all / Cancel prompt for dirty ones. Cancel aborts the switch and leaves the setting un-applied | Honors invariant 8; reuses the existing `closeBuffer` lifecycle rather than inventing a second one |
| 22 | Chord conflicts | First entry in file order wins; the later command loses that one chord, toast names both | The inversion makes duplicate chords expressible where TOML's duplicate-key rule previously forbade them |
| 23 | Ex-commands | Not rebindable. `[editor.*]` binds key chords only; `:w` stays hardcoded and is documented as such in the seeded file | `@replit/codemirror-vim` has `Vim.defineEx` but **no undefine** — `:w` is permanent for the process. `Vim.unmap` does exist, so the `y` override is reversible |
| 24 | Layer precedence | One dispatcher, `editor > active region > global`, first match wins, no fallthrough | Today three independent window listeners race with no ordering beyond mount order; a global `j` would fire alongside the sidebar's. Also repairs invariant 3, currently only half-true |
| 25 | Parse boundary | Rust owns syntax (`toml` crate → plain structure + parse diagnostics), TypeScript owns meaning (command ids, chords, conflicts) | No JS TOML dependency, and it maps exactly onto #10 — syntax rejects the file in Rust, semantics degrade per key in TS |

### Conventions settled without a question

- `settings.toml` keys are **top-level and flat** (four keys, no sub-grouping). The loader tolerates
  a `[settings]` header for forward compatibility; the dialog always writes top-level.
- The config watcher is **separate** from the vault watcher (which `vault.rs` stores as a single
  `Option` and replaces on every `watch()`), non-recursive, filename-filtered, and emits
  **`config-changed`**. Reusing `vault-changed` would make every config save trigger a full
  vault-tree reload (`src/components/layout/Sidebar.tsx:47`).
- The new Tauri commands take an explicit **two-filename allowlist**, not just directory
  containment, with the same canonicalize/symlink-reject discipline as `guarded_path`.

## Explicitly Out of Scope

- Core vim motions, operators and text objects — `@replit/codemirror-vim` keeps them (#13).
- Ex-command rebinding, including removing or aliasing `:w` (#23).
- In-input Enter/Escape handlers: ChatInput submit, FileFinder accept, EntryDraftRow commit,
  CommandBar (#14).
- Settings with no dialog row (#4): the 1500 ms `Ctrl-w` timeout, `DEFAULT_MAX_MESSAGES`, the
  finder's 50-result limit, editor line numbers, line wrapping.
- A leader-key concept.
- Per-vault settings — settings are app-global by decision #1.
- Any keymap **UI**. The keymaps file has exactly one writer, the user; this is why comment
  preservation is only a concern for `settings.toml`.

## Glossary Changes

Added to `.agents/ubiquitous-language.md`: *config file*, *config buffer*, *command registry*,
*command id*, *chord*, *keymap layer*, *keymap resolution*. New invariants for #12, #20 and #24.

Also corrected: **invariant 3 was only half-true** — `src/lib/editor/region-exit.ts` duplicates the
global chord switch inline and only `find-file` routes through `executeAppCommand`. Slice S4 is
what makes the invariant true.

## ADRs Raised

- `.agents/adr/0003-config-file-is-authoritative.md` — the file is the source of truth and the
  Settings dialog is a typed editor of it.
- `.agents/adr/0004-config-outside-vault-surfaced-inside.md` — config lives outside the vault yet
  appears in both vault-scoped surfaces.
- `.agents/adr/0005-keymaps-are-command-keyed.md` — the inverted keymap schema.

## Implementation Slices

Six vertical slices. **S1 is foundation-first and the sole writer of every shared file**
(`package.json`, `Cargo.toml`, lockfiles, the `lib.rs` invoke handler), so siblings only add files.

| Slice | Owns | Depends on |
|-------|------|-----------|
| **S1 — Config backend + command registry** | New `src-tauri/src/config.rs` (path resolution, filename allowlist, `read_config_file`/`write_config_file`, non-recursive `config-changed` watcher, first-run generation). `config.service.ts` + config store (raw text in, parsed value + diagnostics out). Expanded `app-command.ts` registry with dotted ids (#18) rewired at both existing call sites. The single chord parser (`src/lib/keymap/chord.ts`, #17). All dependency additions. **No behavior change.** | — |
| **S2 — settings.toml format + dialog write path** | `settings.rs` JSON→TOML (rewriting ~10 tests including the byte-exact assertion at `settings.rs:241`), `SettingsError::Toml`, migration #16 with atomic rename, `toml_edit` surgical write for the four rows, per-key degradation + toast (#10), disable-writes-while-broken | S1 |
| **S3 — Live apply + vault switch** | `config-changed` subscription, echo suppression + debounce, routing reloaded settings through `useSettingsStore`, full vault re-open with consolidated close prompt (#21) | S1, S2 |
| **S4 — Keymap engine** | Sequence dispatcher replacing the hand-rolled `awaitingCtrlW` booleans (`use-global-keymap.ts:69`, `region-exit.ts:73`), merge-over-defaults with `[]` unbind (#20), conflict resolution (#22), prefix/leaf validation, layer precedence (#24), lockout guard (#15), seeded-catalog generator. Ships `[global]`, `[sidebar]`, `[chat.history]`, `[modal]`. **Sole owner of `doc/keybindings.md`** | S1 |
| **S5 — Editor-layer rebinding** | `save.ts`/`yank.ts` module-scope registration → idempotent apply functions, CM `Compartment` + `StateEffect.reconfigure` in `BufferEditor.tsx` (so a keymap change does not rebuild `EditorState` and destroy undo history), `Vim.unmap` for `y`, the six Ctrl-w editor chords | S1, S4 |
| **S6 — Config buffers** | `source` on `EditorBuffer` + `EditorSaveRequest` (#11), source-aware open and `saveBuffer` routing, wikilink suppression, TOML `StreamLanguage` (#19), sidebar Config section as a separate entry source concatenated into the row list (**not** injected into `sidebar.tree`, which `Sidebar.tsx:41` overwrites wholesale on every `vault-changed`), vault-only guard on `a`/`A` drafts, finder candidates carrying `source`, dirty-buffer rule (#12) | S1, S3 |

```
# edges (child -> depends-on)
S2 -> S1
S3 -> S1, S2
S4 -> S1
S5 -> S1, S4
S6 -> S1, S3

# waves
1 : S1
2 : S2 S4
3 : S3 S5
4 : S6
```

## Known Risks

1. **The `Ctrl-w` prefix rewrite (S4).** Live rebinding requires replacing two hand-rolled prefix
   state machines with a real sequence dispatcher, because the *set of prefixes* becomes derived
   from the merged chord set rather than a hardcoded literal. `@codemirror/view` **throws** on a
   chord used as both a leaf and a prefix, so merged user config must be validated before
   extensions are built — otherwise a bad file is a white screen, not a toast.
2. **Live-apply echo (S3).** `updateSettings` (`settings-store.ts:30`) sets optimistically then
   writes; the watcher then fires and re-applies into the store the dialog renders from. Needs
   content-hash or self-write suppression plus debounce — one `fs::write` emits several notify
   events, and editors that save-by-rename emit Remove+Create.
3. **Vault switch (#21).** Closing every buffer as a side effect of editing a text file is the most
   destructive path in the design. The Cancel branch must genuinely abort, leaving `vaultPath`
   un-applied rather than half-applied.

## Residual Unknowns

None. The frontier emptied cleanly.
