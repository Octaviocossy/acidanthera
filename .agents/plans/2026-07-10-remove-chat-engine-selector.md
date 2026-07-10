# Plan: Remove the engine selector from the AI chat panel

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none_

## Goal

Remove the Claude Code / Codex engine-selector buttons from the AI chat panel (`ChatPanel`), leaving engine selection to exist **only** in the Settings dialog. This removes the duplicate control and the confusing "per-session override that isn't persisted" behavior.

## Context

- **What exists today:** The engine is selectable in **two** places:
  1. `src/components/layout/ChatPanel.tsx` (lines 63–69) renders a bare row of `Badge` buttons — one per registered backend (`listBackends()`) — that call `useChatStore.setBackend(id)`. This is a **per-session override**: it switches the live chat backend but is **never written back** to `settings.json`.
  2. `src/components/layout/SettingsDialog.tsx` (lines 105–123) has an "Engine" row that calls `updateSettings({ engine })` **and** `setBackend(engine)` — it both persists the choice and switches the live backend.
- **What prompted this work:** The two controls are redundant, and the chat-panel one silently diverges from persisted settings. The user wants the chat panel's buttons gone; the Settings dialog becomes the single source of engine selection.
- **Layout constraint the implementer MUST know:** `AiFab` (`src/components/ai/AiFab.tsx`) is positioned `absolute top-4 right-4` inside the shared `relative` container in `Layout.tsx`, so it **floats over the top-right corner of `ChatPanel`**. Today the selector `<div>` is a `shrink-0` flex sibling **above** the scrollable transcript, and it reserves a top band (`h-[calc(var(--rail-fab)_+_var(--space-8))]`) so the FAB floats over that band instead of over transcript rows. If you delete the selector `<div>` outright, the transcript list slides up under the FAB and rows scroll beneath the opaque button. **Therefore the selector `<div>` must be replaced with an empty spacer of the same height — not deleted.**
- **No tests / stories reference this** — the repo has no test runner configured (see `AGENTS.md` → Commands → Test), and a grep for `listBackends`/`backendId`/`setBackend` finds only `chat-store.ts`, `SettingsDialog.tsx`, `ChatPanel.tsx`, `use-settings-bootstrap.ts`, and `backend-registry.ts`. Only `ChatPanel.tsx` is the UI selector being removed.
- **Domain note:** Per `.agents/rules/domain-glossary.md`, editing `src/` domain code requires updating `.agents/ubiquitous-language.md` when a relationship changes. Two Relationships lines and the AiFab doc reference the ChatPanel selector; they must be updated, plus a Changelog row and a "Last updated" bump.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/layout/ChatPanel.tsx` | Remove the engine-selector buttons + now-unused imports/selectors; replace the selector `<div>` with an empty spacer that preserves the FAB's reserved top band |
| MODIFY | `src/components/ai/AiFab.tsx` | Update the doc comment that says the FAB floats "next to the engine selector" (the selector no longer exists) |
| MODIFY | `.agents/ubiquitous-language.md` | Update the two Relationships lines referencing the ChatPanel selector, add a Changelog row, bump "Last updated" |

No files are created or deleted. `useChatStore.setBackend` stays — `SettingsDialog` still calls it.

## Step-by-Step Implementation

> **Step 1 — Remove the unused imports from `ChatPanel`**
>
> - **File:** `src/components/layout/ChatPanel.tsx`
> - **Action:** MODIFY (imports block, lines 1–9)
> - **Details:** Delete the two imports that only the selector uses:
>   - `import { Badge } from '@/components/ui/badge';` (line 5)
>   - `import { listBackends } from '@/lib/agent/backend-registry';` (line 6)
>   - Keep every other import (`ChatInput`, `ChatMessage`, `ToolChip`, `cn`, `useAppStore`, chat-store imports).
>   - Resulting imports block:
>     ```tsx
>     import { useEffect, useRef } from 'react';
>     import { ChatInput } from '@/components/ai/ChatInput';
>     import { ChatMessage } from '@/components/ai/ChatMessage';
>     import { ToolChip, type ToolChipStatus } from '@/components/ai/ToolChip';
>     import { cn } from '@/lib/utils';
>     import { useAppStore } from '@/stores/app-store';
>     import { type ChatItem, type ChatToolCallStatus, useChatStore } from '@/stores/chat-store';
>     ```
> - **Why:** `Badge` and `listBackends` are referenced only inside the selector markup being removed; leaving them would fail `pnpm lint` (Biome flags unused imports) and `pnpm build`.

> **Step 2 — Remove the `backendId` and `setBackend` selectors from `ChatPanel`**
>
> - **File:** `src/components/layout/ChatPanel.tsx`
> - **Action:** MODIFY (component body, lines 43–44)
> - **Details:** Delete these two lines from inside `ChatPanel()`:
>   ```tsx
>   const backendId = useChatStore((state) => state.backendId);
>   const setBackend = useChatStore((state) => state.setBackend);
>   ```
>   Keep `chatOpen`, `isActive`, `items`, `turnActive`, `sendMessage`, and `listRef` — they are all still used.
> - **Why:** Both values are consumed only by the selector markup; removing the markup makes them unused, which fails lint/build.

> **Step 3 — Replace the selector `<div>` with an empty spacer**
>
> - **File:** `src/components/layout/ChatPanel.tsx`
> - **Action:** MODIFY (the JSX block currently at lines 59–69)
> - **Details:** Replace this entire block:
>   ```tsx
>       {/* No header chrome (#39): no rule, no "Chat" title — the panel opens straight into the
>           transcript. The engine selector sits bare on the surface, sized to the FAB's footprint
>           (`top-4` inset, doubled) so the badges center on the FAB now floating at the top-right,
>           and padded right to clear it. Both derive from `--rail-fab` so they track the rail token. */}
>       <div className="flex h-[calc(var(--rail-fab)_+_var(--space-8))] shrink-0 items-center gap-1 pr-[calc(var(--rail-fab)_+_var(--space-6))] pl-3">
>         {listBackends().map((backend) => (
>           <button key={backend.id} type="button" onClick={() => setBackend(backend.id)} aria-pressed={backend.id === backendId}>
>             <Badge tone={backend.id === backendId ? 'plain' : 'muted'}>{backend.label}</Badge>
>           </button>
>         ))}
>       </div>
>   ```
>   with this empty spacer (same reserved height, `shrink-0`, no flex/gap/padding since there is nothing to lay out):
>   ```tsx
>       {/* No header chrome (#39), and the engine selector is gone — the engine is chosen only in
>           Settings now. This empty band still reserves the FAB's footprint (`--rail-fab` + inset)
>           so the FAB, floating top-right over the panel, never overlaps the transcript below. */}
>       <div className="h-[calc(var(--rail-fab)_+_var(--space-8))] shrink-0" />
>   ```
>   - Keep the class expression `h-[calc(var(--rail-fab)_+_var(--space-8))]` **verbatim** — reusing the exact height the selector used guarantees the FAB clearance is unchanged.
>   - Do **not** touch the transcript `<div ref={listRef} …>` or `<ChatInput …>` below it.
> - **Why:** The spacer is a `shrink-0` flex sibling **above** the `overflow-y-auto` transcript, so it permanently reserves a top band the FAB floats over; the scrollable transcript lives entirely below it and never scrolls under the opaque FAB. Deleting the band instead of replacing it would let rows slide under the button.

> **Step 4 — Fix the `AiFab` doc comment that references the selector**
>
> - **File:** `src/components/ai/AiFab.tsx`
> - **Action:** MODIFY (doc comment, lines 9–12)
> - **Details:** In the block comment above `export function AiFab()`, change the sentence that reads:
>   > "when the chat is open it floats over the panel's header-less top row, next to the engine selector; when closed it clears the Viewer's bottom-right vim-mode badge, which the old bottom-right FAB overlapped."
>
>   to drop the now-false "next to the engine selector" clause:
>   > "when the chat is open it floats over the panel's header-less top row; when closed it clears the Viewer's bottom-right vim-mode badge, which the old bottom-right FAB overlapped."
> - **Why:** Keeps the doc comment accurate — the selector it referenced no longer exists. Comment-only change; no behavior impact.

> **Step 5 — Update the domain glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY (Relationships section, Changelog table, "Last updated" line)
> - **Details:**
>   1. In **Relationships**, replace the line:
>      > `ChatPanel` reads the registry directly via `listBackends()` for its backend-selector row; switching `useChatStore.backendId` stops the previously-running backend (if a session had started) before adopting the new one.
>
>      with:
>      > `ChatPanel` no longer renders a backend selector (removed 2026-07-10): the engine is chosen only in `SettingsDialog`, which calls `useChatStore.setBackend` — stopping the previously-running backend if a session had started — alongside persisting `settings.engine`.
>   2. In **Relationships**, replace the line:
>      > `settings.engine` *seeds* `useChatStore.backendId` at boot, and `SettingsDialog` writes it and applies it immediately via `setBackend` (#29) — a `ChatPanel` selector switch remains a per-session override and is never written back to settings.
>
>      with:
>      > `settings.engine` *seeds* `useChatStore.backendId` at boot, and `SettingsDialog` writes it and applies it immediately via `setBackend` (#29). With the `ChatPanel` selector removed, `SettingsDialog` is the sole way to switch engines, so every engine change is now persisted (the per-session override path is gone).
>   3. Add a **Changelog** row at the bottom of the table:
>      > `| 2026-07-10 | Removed `ChatPanel`'s engine-selector row (`listBackends()`/`Badge` buttons), replaced with an empty spacer reserving the FAB band | Engine is now chosen only in `SettingsDialog`; drops the redundant, non-persisted per-session override |`
>   4. Bump the **"Last updated"** line at the top of the file to `2026-07-10` and append a short parenthetical: `Chat engine selector removed — engine chosen only in SettingsDialog`.
> - **Why:** `.agents/rules/domain-glossary.md` requires the glossary to track relationship changes to domain code; two Relationships lines and the Changelog now describe a control that no longer exists.

## Architecture Decisions

- **Keep `useChatStore.setBackend`.** It is still the mechanism `SettingsDialog` uses to switch the live backend when the persisted engine changes. Only its *second* call site (the ChatPanel selector) is removed. Removing the action itself is out of scope and would break Settings.
- **Spacer over deletion.** The removed `<div>` did double duty: it hosted the buttons *and* reserved the FAB's top band. The FAB is a `Layout`-level absolute sibling that floats over the panel, so the reserved band is a layout requirement independent of the buttons. Replacing the `<div>` with an empty same-height spacer preserves that requirement with the least churn. (Alternative considered: add top padding to the transcript scroll container — rejected because padding inside an `overflow-y-auto` box only offsets scroll-top; content would still scroll under the FAB.)
- **Engine selection becomes persist-only.** After this change the only way to switch engines is the Settings dialog, which always writes `settings.engine`. The "per-session override that isn't saved" affordance is intentionally dropped — that ambiguity was part of the motivation.

## Validation Criteria

- [x] `pnpm build` passes (tsc has no unused-symbol / unused-import errors in `ChatPanel.tsx`).
- [x] `pnpm lint` passes (Biome reports no unused imports/variables).
- [x] `pnpm check` passes (lint + format).
- [ ] Manual smoke test (`pnpm dev`):
  - [ ] Open the chat (`Ctrl-w c` or the FAB). The Claude Code / Codex badge buttons no longer appear at the top of the panel.
  - [ ] The `AiFab` still floats at the top-right and does **not** overlap the first transcript row; the empty top band is visible where the buttons used to be.
  - [ ] Send a message — the chat still starts the backend and streams a reply (the removed selector didn't affect send).
  - [ ] Open Settings (`Ctrl-w s`). The "Engine" row still switches engines, and the choice persists across an app restart.

## Open Questions

None.
