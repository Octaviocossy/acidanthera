# Plan: System Clipboard Yank Keymap

> Status: **in-progress**
> Created: 2026-07-22
> Updated: 2026-07-22

## Goal

Extend the editor's Vim `y` operator so Normal-mode yanks (`yy`, `y{motion}`) and Visual Line `y` copy the yanked text to the operating-system clipboard and show success or failure through the existing toast system.

## Context

- The editor uses CodeMirror 6 with `@replit/codemirror-vim` in `src/components/layout/Viewer.tsx`.
- The existing `y` operator writes only to the Vim emulation's internal registers; it does not reliably write to the desktop system clipboard.
- The confirmed Normal-mode behavior is standard Vim semantics: `yy` yanks the current line and `y{motion}` yanks the motion range. A single `y` remains an operator prefix.
- Visual Line mode is represented internally by `cm.state.vim.visualLine`; `useEditorStore.vimMode` intentionally remains the broader `'visual'` value.
- Save feedback establishes the toast pattern: success uses the default info tone and failure uses the error tone.
- Tauri's clipboard-manager plugin will be used instead of `navigator.clipboard`, ensuring native desktop clipboard access under Tauri's capability model.
- Only clipboard write permission is required. Clipboard read access must not be granted.
- Characterwise and blockwise Visual-mode yanks retain standard internal-register behavior but do not copy to the system clipboard under this requirement.
- The existing Vim register must be updated before the asynchronous system clipboard write, so Vim paste remains functional even if native clipboard access fails.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `package.json` | Add the frontend clipboard-manager plugin |
| MODIFY | `pnpm-lock.yaml` | Lock the frontend clipboard-manager dependency |
| MODIFY | `src-tauri/Cargo.toml` | Add the Rust clipboard-manager plugin |
| MODIFY | `src-tauri/Cargo.lock` | Lock the Rust clipboard-manager dependency |
| MODIFY | `src-tauri/src/lib.rs` | Register the clipboard-manager plugin |
| MODIFY | `src-tauri/capabilities/default.json` | Grant system clipboard write permission |
| CREATE | `src/services/clipboard.service.ts` | Wrap the native clipboard write API |
| CREATE | `src/lib/editor/yank.ts` | Register and implement the custom Vim yank operator |
| CREATE | `src/lib/editor/yank.test.ts` | Verify Normal and Visual Line key behavior |
| MODIFY | `src/components/layout/Viewer.tsx` | Load the custom yank mapping before editor use |
| MODIFY | `doc/keybindings.md` | Document the custom clipboard yank behavior |
| MODIFY | `doc/tech-stack.md` | Record the new frontend and Rust plugins |
| MODIFY | `.agents/ubiquitous-language.md` | Add canonical clipboard-yank terminology and relationships |

## Step-by-Step Implementation

> **Step 1 - Install the Tauri clipboard-manager dependencies**
>
> - **Files:** `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`
> - **Action:** MODIFY
> - **Details:** Add `@tauri-apps/plugin-clipboard-manager` with a Tauri v2-compatible `^2` frontend range and `tauri-plugin-clipboard-manager = "2"` to the Rust dependencies.
> - **Details:** Use the repository's package manager and Cargo so both lockfiles are generated rather than edited manually.
> - **Details:** Do not add a generic browser clipboard dependency or a custom Rust clipboard crate.
> - **Why:** The official plugin supplies consistent native clipboard behavior and integrates with Tauri v2 capabilities.

> **Step 2 - Register and authorize the clipboard plugin**
>
> - **File:** `src-tauri/src/lib.rs`
> - **Action:** MODIFY
> - **Details:** Register `.plugin(tauri_plugin_clipboard_manager::init())` on the existing `tauri::Builder`, alongside the log, opener, and dialog plugins.
> - **File:** `src-tauri/capabilities/default.json`
> - **Action:** MODIFY
> - **Details:** Add `"clipboard-manager:allow-write-text"` to the main window's permissions.
> - **Details:** Do not add `clipboard-manager:allow-read`; the feature never reads clipboard contents.
> - **Why:** Tauri v2 denies plugin commands unless the plugin is initialized and the invoking window has explicit permission.

> **Step 3 - Add the clipboard service**
>
> - **File:** `src/services/clipboard.service.ts`
> - **Action:** CREATE
> - **Imports:** `writeText` from `@tauri-apps/plugin-clipboard-manager`
> - **Details:** Export a stateless wrapper matching existing service conventions:
>
> ```ts
> export const clipboardService = {
>   writeText: (text: string): Promise<void> => writeText(text),
> };
> ```
>
> - **Details:** Add a short comment identifying this as the system clipboard write boundary.
> - **Why:** Keeping native I/O behind `src/services/` makes the editor behavior testable without invoking Tauri and matches the repository's service-layer pattern.

> **Step 4 - Implement the custom Vim yank operator**
>
> - **File:** `src/lib/editor/yank.ts`
> - **Action:** CREATE
> - **Imports:** `CM5RangeInterface`, `CodeMirrorV`, `OperatorArgs`, `Pos`, and `Vim` from `@replit/codemirror-vim`; `clipboardService`; `useToastStore`
> - **Details:** Define an operator with this signature:
>
> ```ts
> function systemYank(
>   cm: CodeMirrorV,
>   args: OperatorArgs,
>   ranges: CM5RangeInterface[],
>   oldAnchor: Pos,
> ): Pos
> ```
>
> - **Details:** Read the already-resolved yank text with `cm.getSelection()`. Do not independently calculate the motion range; the Vim engine has already expanded `yy`, `y{motion}`, counts, and Visual Line selections.
> - **Details:** Preserve upstream register behavior by calling:
>
> ```ts
> Vim.getRegisterController().pushText(
>   args.registerName,
>   'yank',
>   text,
>   args.linewise,
>   vim.visualBlock,
> );
> ```
>
> - **Details:** In Normal mode, return `oldAnchor`, matching the built-in yank operator's cursor behavior.
> - **Details:** In Visual mode, calculate and return the earliest position among the visual anchor, visual head, and resolved range endpoints so exiting Visual Line mode places the cursor where the built-in operator would.
> - **Details:** Trigger native clipboard writing only when `!vim.visualMode || vim.visualLine`.
> - **Details:** After a successful write, call `showToast('Yanked to clipboard')`.
> - **Details:** On rejection, call `showToast('Yank failed: <reason>', 'error')`, using the same unknown-error normalization as `useSaveLoop`.
> - **Details:** Do not throw clipboard errors back into the synchronous Vim operator. The internal register must remain populated when native clipboard access fails.
> - **Details:** Register the implementation under a distinct operator name, such as `systemYank`, then prepend mappings for lowercase `y` in the Normal and Visual contexts with `Vim.mapCommand`.
> - **Details:** Keep the mapping module-level, following `src/lib/editor/save.ts`, because `Vim.defineOperator` and `Vim.mapCommand` modify the process-wide Vim singleton.
> - **Details:** Do not remap uppercase `Y`, change delete/change operators, or replace `y` with a one-key line action.
> - **Why:** Registering a Vim operator preserves `yy`, motions, counts, named registers, Visual Line selection handling, and Vim's normal mode transitions.

> **Step 5 - Load the yank mapping in the editor**
>
> - **File:** `src/components/layout/Viewer.tsx`
> - **Action:** MODIFY
> - **Details:** Add a side-effect import of `@/lib/editor/yank` near the other editor integrations.
> - **Details:** Keep `vim()` first in `BASE_EXTENSIONS`; the mapping is process-global and does not need a separate CodeMirror extension entry.
> - **Details:** Update the nearby comment to mention the custom system-yank mapping without implying that it is a CM6 extension.
> - **Why:** Importing the module once ensures the mapping is installed before the editor handles keys without recreating it on React renders.

> **Step 6 - Test observable keymap behavior**
>
> - **File:** `src/lib/editor/yank.test.ts`
> - **Action:** CREATE
> - **Imports:** `EditorView` from `@codemirror/view`; `getCM`, `vim`, and `Vim` from `@replit/codemirror-vim`; Vitest APIs; `clipboardService`; `useToastStore`; side-effect import of `./yank`
> - **Details:** Mock `@/services/clipboard.service`, which is the native I/O boundary. Use the real CodeMirror/Vim integration and real toast store.
> - **Details:** Create and destroy an `EditorView` for each test with a multiline document and `vim()` enabled.
> - **Details:** Drive keys through `Vim.handleKey(cm, key, 'user')` rather than directly calling implementation helpers.
> - **Details:** Reset mocked calls, Vim registers, and toast state before each test.
> - **Details:** Verify `yy` writes the full current line, including its linewise newline, to both the unnamed Vim register and `clipboardService.writeText`.
> - **Details:** Verify a representative `y{motion}` sequence copies the exact motion range and does not alter document contents.
> - **Details:** Verify `V`, a line motion, then `y` writes all selected lines, exits Visual Line mode, preserves document contents, and shows `Yanked to clipboard`.
> - **Details:** Verify characterwise Visual `y` retains internal-register behavior but does not invoke the system clipboard or show the system-yank toast.
> - **Details:** Verify a rejected clipboard write produces an error toast containing `Yank failed:` while the Vim register still contains the yanked text.
> - **Why:** These tests cover the user-facing keystrokes and guard against regressions in operator grammar, range selection, mode exit, clipboard feedback, and failure handling.

> **Step 7 - Update keybinding and dependency documentation**
>
> - **File:** `doc/keybindings.md`
> - **Action:** MODIFY
> - **Details:** Add entries for `yy`, `y{motion}`, and Visual Line `y` under the Editor section.
> - **Details:** State that the completed range is copied to both Vim's internal register and the system clipboard, with success/error toast feedback.
> - **Details:** Clarify that a first Normal-mode `y` remains an operator prefix and does not copy until a second `y` or motion completes the operation.
> - **Details:** Replace the statement that the app has no custom Vim mappings.
> - **Details:** Add `src/lib/editor/yank.ts` to the source-of-truth list.
> - **File:** `doc/tech-stack.md`
> - **Action:** MODIFY
> - **Details:** Add `@tauri-apps/plugin-clipboard-manager` to frontend runtime dependencies and `tauri-plugin-clipboard-manager` to backend crates.
> - **Details:** Update the `lib.rs`, `services/`, and `lib/editor/` descriptions to mention native clipboard integration.
> - **Details:** Update the snapshot date. Correct the already-stale Fontsource rows encountered in the same dependency snapshot so the newly dated table remains truthful; make no broader documentation cleanup.
> - **Why:** Custom bindings and dependency additions must remain discoverable and accurately documented.

> **Step 8 - Update the domain glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:** Bump `Last updated` to `2026-07-22`.
> - **Details:** Add canonical entries for `systemYank` and `clipboardService`, identifying `systemYank` as the editor Vim operator and `clipboardService` as the native clipboard write boundary.
> - **Details:** Record that Normal and Visual Line yanks write the Vim register synchronously, then write the system clipboard asynchronously.
> - **Details:** Update the Toast entry and relationships so they no longer describe `useSaveLoop` as the only toast producer.
> - **Details:** Add a changelog row describing the `y` system-clipboard integration and toast feedback.
> - **Why:** The feature introduces a new named editor process and service boundary covered by the repository's domain-glossary rules.

> **Step 9 - Run automated and manual validation**
>
> - **Action:** VERIFY
> - **Details:** Run `pnpm test`.
> - **Details:** Run `pnpm check`.
> - **Details:** Run `pnpm build`.
> - **Details:** Run `cargo test --manifest-path src-tauri/Cargo.toml`.
> - **Details:** Launch the Tauri app and manually test `yy`, `yw`, a multi-line `y{motion}`, and `V` followed by movement and `y`.
> - **Details:** Paste into an application outside orbit-111 to confirm the operating-system clipboard contains the exact yanked text.
> - **Details:** Confirm the info toast appears only after successful clipboard writing and that the mode badge returns from `visual` to `normal` after Visual Line `y`.
> - **Why:** Unit tests validate key semantics while the desktop smoke test confirms plugin registration, capability permission, native clipboard integration, and toast timing.

## Architecture Decisions

- **Use the official Tauri clipboard-manager plugin.** This avoids browser WebView clipboard restrictions and uses Tauri's explicit native permission model.
- **Grant write-only permission.** The feature does not inspect clipboard contents, so read access would violate least privilege.
- **Implement a Vim operator, not a raw CM6 keymap.** A raw `y` binding would bypass Vim's pending-operator state and break `yy`, motions, counts, and named registers.
- **Use a distinct `systemYank` operator mapping.** This customizes lowercase `y` without globally replacing the upstream `yank` implementation used by unrelated bindings such as uppercase `Y`.
- **Preserve internal yank before native I/O.** Native clipboard failure must not break subsequent Vim `p` operations.
- **Copy the exact Vim-resolved selection.** Linewise ranges retain their trailing newline, matching standard Vim yank semantics.
- **Do not extend `EditorVimMode`.** Visual Line is already available as `cm.state.vim.visualLine`; adding another store state would duplicate the upstream Vim state machine.
- **Scope native copying to Normal and Visual Line modes.** Characterwise and blockwise Visual behavior remains the upstream internal-register behavior because those modes were not requested.
- **Show feedback after clipboard completion.** This mirrors save feedback, where success is announced only after the I/O operation resolves.

## Validation Criteria

- [x] `yy` copies the current logical line to Vim's unnamed register and the system clipboard.
- [x] `y{motion}` preserves standard Vim operator behavior and copies the exact resolved range.
- [x] Counts and named registers continue to work through the custom operator.
- [x] Visual Line `y` copies every selected line and exits to Normal mode.
- [x] Characterwise and blockwise Visual yanks do not invoke the system clipboard.
- [x] Successful clipboard writes show `Yanked to clipboard` using the info toast tone.
- [x] Failed clipboard writes show `Yank failed: <reason>` using the error toast tone.
- [x] Clipboard failure does not clear the Vim register or mutate editor contents.
- [x] The Tauri capability grants `clipboard-manager:allow-write-text` without clipboard read access.
- [x] `pnpm test` passes.
- [x] `pnpm check` passes.
- [x] `pnpm build` passes.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- [ ] Pasting into an external desktop application reproduces the yanked text.

## Open Questions

None. Normal mode will retain the confirmed standard Vim `yy` / `y{motion}` behavior.

## Implementation Notes

- The clipboard-manager plugin's actual write permission is `clipboard-manager:allow-write-text`; the plan's generic `allow-write` label was corrected during Rust build validation.
- Automated validation passed: `pnpm test` (143 tests), `pnpm check`, `pnpm build`, and `cargo test` (47 Rust tests).
- The external-application paste smoke test remains for an interactive desktop session; it cannot be exercised from this non-interactive environment.
