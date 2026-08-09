# Keybindings

orbit-111 is vim-first and keyboard-first — see `doc/v0-spec.md` §3.4 for the design rationale
behind the two-level vim system (app-level focus chords vs. the editor's own CodeMirror vim mode).

Every binding below except the editor's own CodeMirror-vim keys, `:w`, and system-clipboard yank
is **user-rebindable** in `keymaps.toml`, which lives in the platform Tauri app-config dir — on
macOS `~/Library/Application Support/com.ovct.orbit-111/keymaps.toml`. (This is *not* the XDG
`~/.config` path on macOS; `config.rs` resolves it through Tauri's `app_config_dir()`, so it
varies by OS.) The file ships fully commented out, one line per command,
showing its current default; uncomment a line and edit its chord array to rebind it, or set the
array to `[]` to unbind the command entirely. A chord array is always replaced wholesale, never
merged with the default — see the file's own header comment for the full contract. Source of
truth for defaults: `src/lib/keymap/defaults.ts`.

## The dispatcher

A single shared window-level dispatcher (`src/lib/keymap/dispatcher.ts`) resolves every keydown
below — there is no longer one independent `keydown` listener per region. It walks layers in a
fixed precedence order, **first match wins, with no fallthrough**: the editor (CodeMirror, which
wins by DOM event-propagation order before the dispatcher ever runs), then the active region
(sidebar or the chat's History tab), then global. A chord sequence like `Ctrl-w` `f` arms a 1.5s
pending window for its next step; any non-continuing key, the window expiring, or the owning
layer going inactive mid-sequence all silently disarm it with no action taken.

## App-level navigation (works everywhere)

Global-layer bindings work regardless of which region has focus, as long as the keyboard focus
isn't inside an editable field (e.g. the command bar or chat input).

| Keys | Command id | Action | Notes |
|------|------------|--------|-------|
| `Ctrl-w` then `h` | `global.focus-previous` | Move focus to the previous region | Region cycle: sidebar → viewer → chat → sidebar (wraps; `chat` only reachable if the chat panel is open) |
| `Ctrl-w` then `l` | `global.focus-next` | Move focus to the next region | Same cycle, opposite direction |
| `Ctrl-w` then `b` | `global.toggle-sidebar` | Expand/collapse the sidebar | |
| `Ctrl-w` then `c` | `global.toggle-chat` | Toggle the chat panel open/closed | |
| `Ctrl-w` then `s` | `global.toggle-settings` | Toggle the settings dialog | |
| `Ctrl-w` then `f` | `global.find-file` | Open the file finder | |
| `:` | `global.command-mode` | Enter command mode, opens the command bar | Only from normal mode |
| `Escape` | — | Exit command mode, closes the command bar | Only from command mode; not a rebindable command, like `:w` |

## Sidebar (when focused)

Active only while the sidebar region has focus and the app is in normal mode (no modifier keys,
target not editable).

| Keys | Command id | Action | Notes |
|------|------------|--------|-------|
| `j` | `sidebar.cursor-down` | Move cursor to the next row | Clamped at the last row |
| `k` | `sidebar.cursor-up` | Move cursor to the previous row | Clamped at the first row |
| `l` / `Enter` | `sidebar.open` | Open cursor row | Directory: toggle expand. File: open it and move focus to the editor |
| `h` | `sidebar.collapse` | Collapse cursor row | Only if the cursor is on an expanded directory; no-op on files or already-collapsed directories |
| `a` | `sidebar.new-note` | Start naming a new note | Placed as a sibling of the cursor row, or a child if the cursor is on a directory |
| `A` (`Shift-a`) | `sidebar.new-directory` | Start naming a new folder | Same placement rule as `a` |
| `r` | `sidebar.rename` | Rename the cursor entry | Registered for the upcoming rename flow |
| `D` (`Shift-d`) | `sidebar.duplicate` | Duplicate the cursor entry | Places the sidebar cursor on the duplicate |
| `d` then `d` | `sidebar.delete` | Move the cursor entry to Trash | Opens a confirmation that names any dirty buffers whose edits will be discarded |

## File finder

Opened via `Ctrl-w f` (`global.find-file`) — a Spotlight-like overlay for opening a note by fuzzy
name. These keys are handled by the finder's own input, not the shared dispatcher, and are not
rebindable via `keymaps.toml`.

| Keys | Action | Notes |
|------|--------|-------|
| `ArrowDown` | Move the result cursor down | |
| `ArrowUp` | Move the result cursor up | |
| `Enter` | Open the highlighted result | Closes the finder |
| `Escape` | Close the finder without opening anything | |

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
key reference rather than this doc. The editor's bottom-right status cluster shows its live
line and column plus a badge reflecting the current vim submode.

## Chat

The chat panel has two tabs: the live transcript (`Chat`) and a keyboard-navigable list of saved
conversations (`History`, #71).

`Enter` in the chat input submits the message (no-op if empty or while a turn is in progress) —
this is in-input handling, not a dispatcher command.

### History tab (when focused)

Active only while the chat region has focus, the app is in normal mode, and the History tab is
showing.

| Keys | Command id | Action | Notes |
|------|------------|--------|-------|
| `j` | `chat.history.cursor-down` | Move cursor to the next saved chat | Clamped at the last row |
| `k` | `chat.history.cursor-up` | Move cursor to the previous saved chat | Clamped at the first row |
| `l` / `Enter` | `chat.history.open` | Open the highlighted chat | Loads it into the transcript and switches to the Chat tab |

## Command bar

Opened via `:` from normal mode (see App-level navigation above). In v0, both `Enter` and
`Escape` simply close the bar — no ex-commands are wired up to it yet.

---

This doc reflects the current implementation. Source of truth: `src/lib/keymap/defaults.ts` (the
default chord for every rebindable command), `src/lib/keymap/dispatcher.ts` (precedence and
sequence matching), `src/hooks/use-global-keymap.ts`, `src/hooks/use-sidebar-keymap.ts`,
`src/hooks/use-chat-history-keymap.ts`, `src/lib/editor/region-exit.ts`, `src/lib/editor/save.ts`,
`src/lib/editor/yank.ts`, `src/components/layout/FileFinder.tsx`. Update this file whenever a
keybinding is added, changed, or removed.
