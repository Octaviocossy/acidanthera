# Plan: Epic — Agent thinking UX, sidebar cleanup, and Codex repair

> Status: **draft**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #48

## Goal

Make the agent's work visible in the chat (surface its reasoning as a distinct
transcript item + an in-flight "thinking…" loader), stop showing the scaffolded
`AGENTS.md`/`CLAUDE.md` in the sidebar, and repair the Codex engine.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #49 | `49-chat-thinking-ux` | feat: chat thinking UX — surface agent reasoning + in-flight loader | pending |
| 1 | #50 | `50-hide-agent-context-files` | fix: hide AGENTS.md and CLAUDE.md from the sidebar tree | pending |
| 2 | #51 | `51-fix-codex-backend` | fix: repair the Codex backend | pending |

## Dependency Edges

```
51 -> 49
```

- #49 and #50 are independent (wave 1) and run in parallel.
- #51 depends on #49 only because both edit `src/lib/agent/backends/codex.backend.ts`
  (#49 adds the `agent_reasoning` emit; #51 hardens the field names, including that
  reasoning path). It also benefits from #49's `agent_reasoning` event contract.

## Notes

- **Merged spec items:** the user's spec had four items — (1) show reasoning, (2) add a
  loader, (3) hide AGENTS.md/CLAUDE.md, (5) fix Codex. Items 1 and 2 are merged into #49
  (both edit `ChatPanel.tsx` and are one coherent "thinking UX"), yielding three children.
- **Build-on dependency:** all children reference the in-flight model-selector work
  (`src/lib/agent/model-catalog.ts`, the 3-arg `AgentBackend.start(cwd, model, onEvent)`,
  `useChatStore.modelId`). That work is currently **uncommitted** in the working tree.
  **Commit it to `main` before running `/execute-epic`**, or the parallel branches will
  build against a `main` that lacks those files.
- **#51 is environment-gated:** Codex's root failure is a broken local install (dangling
  `/opt/homebrew/bin/codex` symlink → `CommandNotFound`). A headless agent can land the
  code hardening (defensive `item.type ?? item.item_type`, flag/resume fixes from `--help`,
  model-id corrections) but real-stream pinning and end-to-end verification require a
  machine with a working `codex` install.

## Next step

Run `/execute-epic` to execute the current frontier (wave 1: #49, #50) in parallel, open
PRs, and tick the epic task-list — then merge that wave before re-running for wave 2 (#51).
