# Plan: Settings dialog

> Status: **completed**
> Created: 2026-07-09
> Updated: 2026-07-09
> Issue: #29

## Goal

Give the app a settings dialog — a modal overlay editing the four persisted settings from #25
(agent engine, editor font, theme, vault path) — plus the reactive engine wiring the settings
foundation deferred to this slice.

## Context

- Child #29 of epic #24 (`.agents/plans/2026-07-09-epic-settings-ux.md`), wave 2, depends only
  on #25 (settings foundation, merged). #28 (apply theme & editor font) runs in parallel and is
  **not** a dependency: this slice edits `theme`/`editorFont` values through the same
  `useSettingsStore` write-through that #28 reads, so the two compose without touching the same
  files.
- Note: the GitHub issue body was unreachable from the headless runner (no GitHub access by
  design), so this plan is reconstructed from the epic plan's goal ("User-configurable settings
  … behind a settings dialog"), the settings-foundation plan's explicit hand-offs to #29
  ("reactive engine switching from the settings dialog is #29's wiring"; "the settings file
  always round-trips a concrete resolved path … which is what #29's dialog needs to display"),
  and the glossary's #29 references.
- Today: settings exist and persist (#25) but the only UIs touching them are the boot bootstrap
  and the Sidebar's vault-pick persistence. There is no way to see or edit `engine`/`theme`/
  `editorFont` from the app, and no settings UI at all.
- Design constraints (doc/v0-spec.md §5.6): monochrome, keyboard-first, fades only, the lime
  accent stays exclusive to the AiFab. The dialog is hand-built on existing primitives
  (`Button`, `Badge`) — no new dependencies.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/stores/app-store.ts` | Add `settingsOpen` + `openSettings`/`closeSettings`/`toggleSettings` (mirrors `chatOpen`) |
| CREATE | `src/lib/vault/pick-vault.ts` | Shared `pickAndPersistVault()` helper (Sidebar + dialog both pick a vault and persist it) |
| MODIFY | `src/components/layout/Sidebar.tsx` | Replace inline `handleOpenVault` with the shared helper |
| CREATE | `src/components/layout/SettingsDialog.tsx` | The modal overlay: engine/theme/font/vault rows |
| MODIFY | `src/components/layout/Layout.tsx` | Mount `<SettingsDialog />` |
| MODIFY | `src/components/layout/StatusBar.tsx` | Pointer entry point: quiet "settings" button |
| MODIFY | `src/hooks/use-global-keymap.ts` | Keyboard entry point: `Ctrl-w` `s` toggles the dialog |
| MODIFY | `src/lib/editor/region-exit.ts` | Mirror the `s` chord inside CM6 (coexistence rule — otherwise vim would eat `s` as substitute) |
| MODIFY | `.agents/ubiquitous-language.md` | New entities, updated relationships, changelog row |

## Step-by-Step Implementation

> **Step 1 — `settingsOpen` app-shell state**
>
> - **File:** `src/stores/app-store.ts`
> - **Action:** MODIFY
> - **Details:** Add `settingsOpen: boolean` (initial `false`) and `openSettings()`/
>   `closeSettings()`/`toggleSettings()` actions, shaped exactly like the `chatOpen` trio.
>   The dialog is an overlay, not a `FocusRegion` — no `activeRegion` interplay.
> - **Why:** the two entry points (StatusBar, keymap) live in different components; overlay
>   visibility is app-shell state like `chatOpen`.

> **Step 2 — shared vault-pick helper**
>
> - **File:** `src/lib/vault/pick-vault.ts`
> - **Action:** CREATE
> - **Details:** `pickAndPersistVault(): Promise<string | null>` — `vaultService.pickVault()`
>   (return `null` on rejection = cancelled dialog), then `useAppStore.setVaultRoot(root)` and
>   `void useSettingsStore.updateSettings({ vaultPath: root })`. Same pattern as
>   `src/lib/vault/open-file.ts` (a store-wiring helper shared by two call sites).
> - **Why:** the dialog's "Change…" action is byte-for-byte the Sidebar's `handleOpenVault`;
>   extract instead of duplicating.

> **Step 3 — Sidebar uses the helper**
>
> - **File:** `src/components/layout/Sidebar.tsx`
> - **Action:** MODIFY — replace `handleOpenVault` with `() => void pickAndPersistVault()`;
>   drop the now-unused `setVaultRoot`/`updateSettings`/`useSettingsStore` wiring.

> **Step 4 — the dialog**
>
> - **File:** `src/components/layout/SettingsDialog.tsx`
> - **Action:** CREATE
> - **Details:** Renders `null` unless `useAppStore.settingsOpen`. Scrim (`absolute inset-0`,
>   `bg-bg/70`, click closes) + centered panel (`rounded-md border border-border-active
>   bg-surface`, ~420px). Focuses the panel on open; window-level `Escape` listener closes;
>   panel `onKeyDown` stops propagation of every non-Escape key so global chords/`:` never fire
>   under the modal. Rows (label = tracked-caps dim text, control right):
>   - **Engine** — `listBackends()` as `Badge` toggle buttons (ChatPanel selector pattern).
>     Selecting writes `updateSettings({ engine })` **and** calls `useChatStore.setBackend`
>     (the reactive wiring #25 deferred; ChatPanel's selector stays a per-session override).
>   - **Theme** — `dark`/`light` `Badge` toggles → `updateSettings({ theme })` (applied by #28).
>   - **Editor font** — text input, local draft state, commit on blur/Enter (trimmed, no-op if
>     empty/unchanged) → `updateSettings({ editorFont })` (applied by #28).
>   - **Vault** — truncated `settings.vaultPath` + ghost "Change…" button →
>     `pickAndPersistVault()`.
> - **Why:** one modal, existing primitives, write-through store — #28 picks the values up with
>   zero coupling.

> **Step 5 — mount + entry points**
>
> - **Files:** `src/components/layout/Layout.tsx`, `src/components/layout/StatusBar.tsx`,
>   `src/hooks/use-global-keymap.ts`, `src/lib/editor/region-exit.ts`
> - **Details:** Mount `<SettingsDialog />` after `AiFab` and before `ToastHost` (toasts stay
>   visible above the scrim). StatusBar gains a quiet `settings` button (right side, before the
>   mode badge) calling `openSettings`. Both `Ctrl-w` chord handlers gain `case 's'` →
>   `toggleSettings()` — the CM6 mirror is mandatory: without it, `Ctrl-w s` inside the editor
>   falls through to vim's substitute command.

> **Step 6 — glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY — add `SettingsDialog` + `pickAndPersistVault` entities; update the
>   `Settings`, global-keymap and `regionExit` rows (`s` chord, dialog now built); rewrite the
>   `settings.engine` relationship (dialog applies reactively; ChatPanel stays session-scoped);
>   changelog row; bump "Last updated".

## Architecture Decisions

- **`settingsOpen` lives in `useAppStore`, not a new store** — it is app-shell overlay state
  exactly like `chatOpen`; a fourth store for one boolean would fight the established shape.
- **Dialog applies `engine` immediately via `setBackend`** (stops any running session, same as
  the ChatPanel selector) rather than only-at-boot: this is the "reactive engine wiring"
  #25 explicitly deferred to #29. The ChatPanel selector remains a per-session override that is
  *not* written back to settings.
- **Theme/font are edited but not applied here** — application is #28 (parallel wave-2 sibling);
  both slices meet only at `useSettingsStore`, avoiding file conflicts.
- **No toasts** — #27's glossary contract says `useSaveLoop` is v0's only toast producer;
  settings write failures are logged backend-side (`logs/orbit-111.log`), matching the
  Sidebar's existing `void updateSettings` pattern.
- **Hand-built modal, no shadcn Dialog/radix portal dependency** — consistent with CommandBar/
  ToastHost being plain absolutely-positioned overlays inside Layout's relative container.

## Validation Criteria

- [x] `pnpm build` passes (tsc + vite)
- [x] `pnpm lint` passes (`pnpm check` — lint + format — passes too)
- [ ] Manual: StatusBar button and `Ctrl-w s` (both outside and inside the editor) open the
      dialog; Escape / scrim click close it _(GUI smoke test not possible from the headless
      runner)_
- [ ] Manual: engine change switches the chat backend immediately and persists; theme/font/vault
      edits persist to `settings.json` _(same)_

## Open Questions

None (issue body unavailable; deviations, if any, to be reconciled at ship-note time).
