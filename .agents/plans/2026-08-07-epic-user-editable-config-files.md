# Plan: Epic — User-editable config files (settings + keymaps)

> Status: **draft**
> Created: 2026-08-07
> Updated: 2026-08-07
> Issue: #94
> Integration branch: epic/94-user-editable-config-files
> Spec: `.agents/specs/2026-08-07-user-editable-config-files.md`

## Goal

Give the user two TOML files — an app-settings file carrying everything the Settings dialog
exposes, and a keymaps file that actually rebinds the app — editable in orbit's own editor and
reachable through the fuzzy finder.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #95 | `95-config-backend-foundation` | feat: config backend + command registry foundation | pending |
| 2 | #96 | `96-settings-toml-migration` | feat: settings.toml format migration + dialog write path | pending |
| 2 | #97 | `97-keymap-engine` | feat: keymap engine — dispatcher, merge, seeding | pending |
| 3 | #98 | `98-live-apply-vault-switch` | feat: live config apply + vault switch | pending |
| 3 | #99 | `99-editor-layer-rebinding` | feat: editor-layer rebinding | pending |
| 4 | #100 | `100-config-buffers` | feat: config buffers — source routing, sidebar section, highlighting | pending |

## Dependency Edges

```
96 -> 95
97 -> 95
98 -> 95
98 -> 96
99 -> 95
99 -> 97
100 -> 95
100 -> 98
```

## Architecture Decisions

The 24 settled decisions live in the spec and are authoritative. Three were promoted to ADRs:

- `.agents/adr/0003-config-file-is-authoritative.md` — the file is the source of truth; the Settings
  dialog is a typed editor of it. This is what forces `toml_edit`, the config watcher, echo
  suppression, and the disable-writes-while-broken rule.
- `.agents/adr/0004-config-outside-vault-surfaced-inside.md` — config lives in the app config dir yet
  appears in both vault-scoped surfaces, with two documented contract exceptions.
- `.agents/adr/0005-keymaps-are-command-keyed.md` — the inverted schema, and why chord-keyed was
  rejected.

Two decisions **superseded** earlier answers during the design interrogation, and the spec records
both so they are not proposed again:

- **#14** narrowed the command surface from "every keyboard action" to "every action dispatched
  outside a focused text input, plus a `[modal]` dismiss table" — in-input keys need a second,
  component-scoped dispatch path, different in kind.
- **#20** inverted the keymap schema from chord-keyed to command-keyed — chord-keyed with
  overrides-only merging can only ADD, making rebinding impossible.

## Decomposition Rationale

**#95 is foundation-first** and the sole writer of every shared file (`package.json`, `Cargo.toml`,
both lockfiles, the `invoke_handler!` list in `src-tauri/src/lib.rs`), so its five siblings only add
files. It deliberately ships **no behavior change**.

The remaining edges follow data-before-UI: #96 (the settings format) precedes #98 (applying it
live), and #98 precedes #100 (editing it in a buffer, which must agree with the watcher on what a
save does). #97 (the keymap engine) precedes #99 (the editor layer that consumes a resolved keymap).

`doc/keybindings.md` is assigned to **#97 alone** — it declares itself must-update-on-every-change
and would otherwise conflict across parallel branches.

## Validation Criteria

- [ ] All six children merged into `epic/94-user-editable-config-files`
- [ ] `pnpm check` passes on the epic branch
- [ ] `pnpm build` passes on the epic branch
- [ ] `pnpm test` passes on the epic branch
- [ ] `pnpm test:rust` passes on the epic branch
- [ ] End-to-end smoke on the epic branch:
  1. Launching with an existing `settings.json` migrates it and deletes it; `settings.toml` carries
     the prior values plus commented docs
  2. `Ctrl-w f` → `settings` opens the file, TOML-highlighted, no wikilink decoration
  3. `theme = "light"` + `:w` flips the theme live; the dialog reflects it
  4. Toggling theme in the dialog preserves comments and key order
  5. A syntax error toasts with its line, keeps last-good applied, and disables dialog controls
  6. `"global.find-file" = ["ctrl-p"]` rebinds; `[]` unbinds
  7. Two commands claiming one chord — first wins, toast names both
  8. Unbinding a modal dismiss falls back to default; the modal stays escapable
  9. Changing `vaultPath` with a dirty buffer prompts once; Cancel aborts the switch cleanly
- [ ] Epic PR opened against `main` with `Closes #94`

## Open Questions

None. The spec's frontier emptied cleanly.
