# Keybindings

orbit-111 is vim-first and keyboard-first — see `doc/v0-spec.md` §3.4 for the design rationale
behind the two-level vim system (app-level focus chords vs. the editor's own CodeMirror vim mode).

## App-level navigation (works everywhere)

These fire from a `window`-level listener and work regardless of which region has focus, as
long as the keyboard focus isn't inside an editable field (e.g. the command bar or chat input).

| Keys | Action | Notes |
|------|--------|-------|
| `Ctrl-w` then `h` | Move focus to the previous region | Region cycle: sidebar → viewer → chat → sidebar (wraps; `chat` only reachable if the chat panel is open) |
| `Ctrl-w` then `l` | Move focus to the next region | Same cycle, opposite direction |
| `Ctrl-w` then `b` | Toggle the sidebar open/closed | |
| `Ctrl-w` then `c` | Toggle the chat panel open/closed | |
| `Ctrl-w` then `s` | Toggle the settings dialog | |
| `Ctrl-w` then `f` | Open the file finder | |
| `:` | Enter command mode, opens the command bar | Only from normal mode |
| `Escape` | Exit command mode, closes the command bar | Only from command mode |

`Ctrl-w` arms a 1.5s window for the next key (`h`/`l`/`b`/`c`/`s`/`f`); any other key, or letting the
window expire, silently disarms it with no action taken.

## Sidebar (when focused)

Active only while the sidebar region has focus and the app is in normal mode (no modifier keys,
target not editable).

| Keys | Action | Notes |
|------|--------|-------|
| `j` | Move cursor to the next row | Clamped at the last row |
| `k` | Move cursor to the previous row | Clamped at the first row |
| `l` / `Enter` | Open cursor row | Directory: toggle expand. File: open it and move focus to the editor |
| `h` | Collapse cursor row | Only if the cursor is on an expanded directory; no-op on files or already-collapsed directories |

## Editor

### Region navigation

`Ctrl-w h` / `Ctrl-w l` / `Ctrl-w b` / `Ctrl-w c` / `Ctrl-w s` / `Ctrl-w f` work identically while the editor is focused — CodeMirror
registers the same chord at top precedence and stops propagation so the window-level listener
doesn't double-fire (the "CodeMirror coexistence rule," `doc/v0-spec.md` §3.4).

### Saving

| Keys | Action | Notes |
|------|--------|-------|
| `:w` | Save the current file | Vim ex-command; works from vim command mode |
| `Cmd-S` (macOS) / `Ctrl-S` (Linux/Windows) | Save the current file | Works from any vim submode while the editor is focused |

Both trigger the same save action, which persists to disk via the save loop.

### Copying

| Keys | Action | Notes |
|------|--------|-------|
| `yy` | Copy the current line | Standard linewise Vim yank; copies to the Vim register and system clipboard. |
| `y{motion}` | Copy the motion range | The first `y` remains an operator prefix, such as `yw` to copy a word. |
| `V` then `y` | Copy selected lines | Visual Line yank; copies the selected lines to the Vim register and system clipboard. |

Successful system clipboard writes show a `Yanked to clipboard` info toast. Failures show an
error toast while preserving the Vim register, so an in-editor paste remains available.

### Vim mode

Vim emulation is enabled by default (no toggle in v0). Beyond the `:w` ex-command and the clipboard
yank behavior above, standard `@replit/codemirror-vim` keys (insert `i`/`a`/`o`, visual `v`/`V`,
replace `R`, `Esc`, motions, operators like `d`/`c`, other ex-commands, etc.) work unmodified. See
the [`@replit/codemirror-vim` project](https://github.com/replit/codemirror-vim) for the full vim
key reference rather than this doc. The editor shows a live mode indicator badge (bottom-right)
reflecting the current vim submode.

## Chat

`Enter` in the chat input submits the message (no-op if empty or while a turn is in progress).
There's no vim-style navigation within the chat region yet — use the app-level chords above to
move focus to and from it.

## Command bar

Opened via `:` from normal mode (see App-level navigation above). In v0, both `Enter` and
`Escape` simply close the bar — no ex-commands are wired up to it yet.

---

This doc reflects the current implementation. Source of truth: `src/hooks/use-global-keymap.ts`,
`src/hooks/use-sidebar-keymap.ts`, `src/lib/editor/region-exit.ts`, `src/lib/editor/save.ts`,
`src/lib/editor/yank.ts`. Update this file whenever a keybinding is added, changed, or removed.
