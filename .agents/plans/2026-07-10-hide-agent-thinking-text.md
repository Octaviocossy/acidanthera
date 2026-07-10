# Plan: Hide agent thinking text from the chat transcript

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: _none_ (partial UI walk-back of #49 "Chat thinking UX")

## Goal

Stop rendering the agent's reasoning/thinking **text** in the chat transcript, showing only
the agent's final response. The in-flight "Thinking" loader (which shows activity, not text)
stays. This reverses the visible half of #49 while leaving the underlying `AgentEvent` contract
and both backends untouched, so the choice is trivially reversible.

## Context

- **What exists today.** #49 ("Chat thinking UX", epic #48) added a distinct reasoning
  transcript item. The pipeline is:
  1. Each backend (`claude-code.backend.ts`, `codex.backend.ts`) emits an `agent_reasoning`
     `AgentEvent` (`src/lib/agent/agent-event.ts` → `AgentReasoningEvent`) for thinking blocks.
  2. `useChatStore.applyAgentEvent` (`src/stores/chat-store.ts`) turns each `agent_reasoning`
     event into a `ChatItem` of `kind: 'agent_reasoning'` and appends it to `items`.
  3. `ChatPanel`'s `ChatItemRow` (`src/components/layout/ChatPanel.tsx`) renders that item via
     `ReasoningBlock` (`src/components/ai/ReasoningBlock.tsx`) — the "THINKING" label + italic,
     dimmed reasoning text visible in the screenshot.
  4. Separately, `ThinkingIndicator` (`src/components/ai/ThinkingIndicator.tsx`) renders a
     pulsing "… Thinking" **loader** for the whole `turnActive` duration — it shows no reasoning
     text, only that the agent is working.
- **Trigger.** The user wants the transcript to show only the agent's answer, not the reasoning
  text — see the attached screenshot where the "THINKING" block is exactly what should disappear.
- **Constraints / dependencies the implementer must know.**
  - `src/` is canonical domain code — `.agents/ubiquitous-language.md` documents `ReasoningBlock`,
    `agent_reasoning` (on both `AgentEvent` and `ChatItem`), and `ThinkingIndicator`. The glossary
    **must** be updated per `.agents/rules/domain-glossary.md`.
  - `applyAgentEvent`'s `switch` is exhaustive over `AgentEvent['type']`. Because we are **keeping**
    `AgentReasoningEvent` in the `AgentEvent` union (backends keep emitting it), the
    `case 'agent_reasoning'` arm must remain — it just returns `{}` (discard) instead of appending
    an item. Do **not** delete the case, or TypeScript loses exhaustiveness and the event would
    fall through.
  - `ChatItemRow`'s `switch` is over `ChatItem['kind']` with no `default`. Removing the
    `agent_reasoning` variant from `ChatItem` and removing its `case` must happen together, or
    `tsc` (run via `pnpm build`) fails.
  - No test runner is configured; verification is `pnpm build` + `pnpm lint` + a manual smoke test.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/stores/chat-store.ts` | Drop the `agent_reasoning` variant from `ChatItem`; discard the `agent_reasoning` event in `applyAgentEvent` (return `{}`) so reasoning text never enters app state. |
| MODIFY | `src/components/layout/ChatPanel.tsx` | Remove the `ReasoningBlock` import and the `agent_reasoning` render case in `ChatItemRow`. |
| DELETE | `src/components/ai/ReasoningBlock.tsx` | No longer rendered anywhere. |
| MODIFY | `.agents/ubiquitous-language.md` | Remove the `ReasoningBlock` entity row; update the `ChatItem` entry (reasoning is no longer a `ChatItem`); bump "Last updated"; add a Changelog row. |

**Deliberately unchanged** (documented in Architecture Decisions):
`src/lib/agent/agent-event.ts` (keeps `AgentReasoningEvent`), both backend adapters (keep emitting
`agent_reasoning`), and `src/components/ai/ThinkingIndicator.tsx` (the loader stays).

## Step-by-Step Implementation

> **Step 1 — Drop the `agent_reasoning` transcript item and discard the event**
>
> - **File:** `src/stores/chat-store.ts`
> - **Action:** MODIFY
> - **Details:**
>   - In the `ChatItem` union (currently lines 20–25), **remove** the line:
>     ```ts
>       | { kind: 'agent_reasoning'; id: string; text: string }
>     ```
>     so the union becomes exactly:
>     ```ts
>     export type ChatItem =
>       | { kind: 'user_message'; id: string; text: string }
>       | { kind: 'agent_message'; id: string; text: string }
>       | { kind: 'tool_call'; id: string; call: ChatToolCall }
>       | { kind: 'error'; id: string; message: string };
>     ```
>   - In `applyAgentEvent` (currently lines 50–51), **replace** the `agent_reasoning` case body so
>     it discards instead of appending. Keep the `case` label (the `AgentEvent` union still contains
>     `agent_reasoning`, so the switch must stay exhaustive):
>     ```ts
>         // Reasoning/thinking text is intentionally not surfaced in the transcript — the chat
>         // shows only the agent's final answer. Backends still emit `agent_reasoning`; discard it
>         // here so the reasoning text never enters app state (trivially re-enable by appending an
>         // item again). The in-flight `ThinkingIndicator` loader still conveys activity.
>         case 'agent_reasoning':
>           return {};
>     ```
>   - Leave every other case (`agent_message`, `tool_call_start`, `tool_call_result`, `turn_done`,
>     `error`, `permission_request`) untouched.
> - **Why:** Discarding at the store is the single choke point that guarantees no reasoning text
>   reaches — or is stored by — the UI, while keeping the backend↔store event contract intact.

> **Step 2 — Stop rendering `ReasoningBlock` in the chat panel**
>
> - **File:** `src/components/layout/ChatPanel.tsx`
> - **Action:** MODIFY
> - **Details:**
>   - Remove the import (currently line 4):
>     ```ts
>     import { ReasoningBlock } from '@/components/ai/ReasoningBlock';
>     ```
>   - In `ChatItemRow`'s `switch` (currently lines 18–37), remove the reasoning case (currently
>     lines 26–27):
>     ```ts
>         case 'agent_reasoning':
>           return <ReasoningBlock text={item.text} />;
>     ```
>     After removal, the switch handles exactly `user_message`, `agent_message`, `error`, and
>     `tool_call` — which matches the trimmed `ChatItem` union from Step 1, so the switch stays
>     total with no `default`.
>   - **Do not** touch the `ThinkingIndicator` import (line 5) or its render at
>     `{turnActive && <ThinkingIndicator />}` (line 68) — the loader stays.
> - **Why:** `ChatPanel` is the only renderer of `ReasoningBlock`; removing the case here plus
>   Step 1's union change makes the reasoning path fully dead.

> **Step 3 — Delete the now-unused `ReasoningBlock` component**
>
> - **File:** `src/components/ai/ReasoningBlock.tsx`
> - **Action:** DELETE
> - **Details:** After Step 2 there are no remaining importers (verified: the only references were
>   `ChatPanel.tsx` line 4 and line 27). Delete the file so no dead component lingers.
> - **Why:** Keeps the `ai/` component set honest — every file there is rendered.

> **Step 4 — Update the ubiquitous-language glossary**
>
> - **File:** `.agents/ubiquitous-language.md`
> - **Action:** MODIFY
> - **Details:**
>   - **Remove** the `ReasoningBlock` row from the "Core entities" table (the row whose Term is
>     "ReasoningBlock").
>   - **Update** the `ChatItem` row: its Notes currently read
>     "`agent_message` / `agent_reasoning` / `tool_call` / `error` (derived 1:1 or accumulated…)".
>     Change to drop `agent_reasoning` and note the deliberate discard, e.g.:
>     "`agent_message` / `tool_call` / `error` (derived 1:1 or accumulated from `AgentEvent`s by
>     `useChatStore`). `agent_reasoning` events are intentionally **not** materialized as a
>     `ChatItem` — reasoning text is hidden from the transcript; only the agent's final answer and
>     the in-flight `ThinkingIndicator` loader are shown."
>   - **Leave** the `Agent event` row as-is: `AgentEvent` still includes `agent_reasoning` (backends
>     still emit it). Optionally append a clause noting the store discards it for display.
>   - **Leave** the `ThinkingIndicator` row as-is (still the in-flight loader).
>   - Bump the top-of-file **"Last updated"** line to `2026-07-10` with a short parenthetical, e.g.
>     "(Agent thinking text hidden — `agent_reasoning` still emitted by both backends but discarded
>     by `useChatStore`; `ReasoningBlock` removed; `ThinkingIndicator` loader retained)".
>   - Add a **Changelog** table row:
>     `| 2026-07-10 | Removed `ReasoningBlock`; `ChatItem` no longer has an `agent_reasoning` variant (event discarded in `applyAgentEvent`) | Hide agent thinking text from the transcript — show only the final response; `AgentEvent.agent_reasoning` and both backends kept for trivial reversibility |`
> - **Why:** `.agents/rules/domain-glossary.md` mandates the glossary track entity/state removals,
>   with a "Last updated" bump and a Changelog row.

## Architecture Decisions

- **Discard at the store, not just at the UI.** Three layers could suppress reasoning:
  (A) leave everything and just skip rendering in `ChatPanel`; (B) stop materializing the
  `agent_reasoning` `ChatItem` in the store (chosen); (C) fully revert #49 — remove
  `AgentReasoningEvent` from `AgentEvent` and stop both backends emitting it.
  - (A) rejected: reasoning text would still accumulate in `useChatStore.items`, i.e. live in app
    state and leak into any future transcript export — "not shown" but still stored.
  - (C) rejected: it churns the `AgentEvent` contract and both backend adapters (whose parsing is
    pinned against captured real streams — Claude Code 2.1.204, codex-cli 0.143.0), and makes
    re-enabling later a multi-file change. The reasoning data is cheap to keep flowing.
  - (B) chosen: a single-line discard (`case 'agent_reasoning': return {}`) is the narrowest change
    that guarantees reasoning text never enters app state, keeps the backend↔store contract and the
    stream-pinning intact, and makes re-enabling a one-line edit.
- **Keep `ThinkingIndicator`.** It renders no reasoning **text** — only a pulsing loader signalling
  the turn is active. The request was to hide the thinking *text* ("only the response of the
  agent"), not to remove the activity affordance. Kept by default; see Open Questions to override.
- **Keep the `case 'agent_reasoning'` arm in `applyAgentEvent`.** Because `AgentEvent` retains
  `AgentReasoningEvent`, deleting the arm would break the switch's exhaustiveness over
  `AgentEvent['type']` and let the event fall through. It returns `{}` (no state change) instead.

## Validation Criteria

- [x] `pnpm build` passes (includes `tsc`): confirms the `ChatItem`/`ChatItemRow` switches are still
      exhaustive after removing the `agent_reasoning` variant and case, and that no import of the
      deleted `ReasoningBlock` remains.
- [x] `pnpm lint` passes (Biome): no unused-import / unused-symbol errors for `ReasoningBlock`.
- [x] `grep -rn "ReasoningBlock" src/` returns **no** matches.
- [x] `grep -rn "kind: 'agent_reasoning'" src/` returns **no** matches (the `ChatItem` variant is
      gone); `grep -rn "agent_reasoning" src/lib/agent/backends` still shows both backends emitting
      it (contract intact).
- [ ] Manual smoke test (`pnpm dev`): open the chat, send a prompt to a reasoning-capable model
      (e.g. Sonnet 5 via Claude Code, or a Codex model). During the turn the "… Thinking" loader
      appears; when the turn completes, **only** the agent's answer bubble is shown — no "THINKING"
      block with reasoning text (i.e. the screenshot's THINKING section is gone).

## Open Questions

- **Keep the `ThinkingIndicator` loader?** The plan keeps it (default) because it shows activity,
  not reasoning text. If the user wants the transcript fully free of any "Thinking" affordance,
  remove `ThinkingIndicator` from `ChatPanel` (drop the import at line 5 and the
  `{turnActive && <ThinkingIndicator />}` render at line 68, and optionally delete
  `src/components/ai/ThinkingIndicator.tsx`). This does not block execution — confirm during review.
