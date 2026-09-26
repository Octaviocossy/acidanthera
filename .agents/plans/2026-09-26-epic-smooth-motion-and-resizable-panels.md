# Plan: Epic — Smooth motion and resizable panels

> Status: **draft**
> Created: 2026-09-26
> Issue: #176
> Integration branch: epic/176-smooth-motion-and-resizable-panels

## Goal

Replace the app's instant jumps with a short, mechanical motion vocabulary across panels, overlays,
lists and long scrolls. Let the expanded sidebar and the agent panel be resized with the mouse,
remembered in `settings.toml`, without changing anything for someone who never drags. Source:
`.agents/specs/2026-09-26-smooth-motion-and-resizable-panels.md` (27 settled decisions) and
`.agents/adr/0133-motion-extends-beyond-fades.md`.

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #177 | `177-motion-foundation` | feat: add the motion foundation — tokens, reduced motion, exit phase | pending |
| 2 | #178 | `178-animate-dialogs` | feat: animate dialogs in and out | pending |
| 2 | #179 | `179-animate-popovers-and-toasts` | feat: animate the context menu, tooltip and toasts | pending |
| 2 | #180 | `180-animate-panels` | feat: animate the sidebar collapse and the agent panel | pending |
| 2 | #181 | `181-smooth-scroll-and-theme` | feat: smooth read-view jumps and crossfade the theme switch | pending |
| 3 | #182 | `182-resizable-panels` | feat: resize the sidebar and agent panel with the mouse | pending |
| 3 | #183 | `183-animate-lists-and-hover` | feat: animate list changes and hover states | pending |

## Dependency Edges

```
178 -> 177
179 -> 177
180 -> 177
181 -> 177
182 -> 180
183 -> 180
183 -> 181
```

## File Ownership

Children in one wave run in parallel and integrate one after another, so no two children in the
same wave edit the same file. Each child issue repeats its own do-not-touch list. The shared seams
are these:

- **#177** is the only child of wave 1.
  - It owns `package.json` and `pnpm-lock.yaml`, `src/lib/motion/{tokens,use-exit-phase,variants}.ts`,
    the `@theme` block of `index.css`, `App.tsx` and `src/test/setup.ts`.
  - It also owns the glossary rows *Motion tokens* and *Exit phase*, invariant 60, `SKILL.md` and
    ADR 0129.
- **Wave 2 — #178, #179, #180, #181.**
  - #178 is the only wave-2 child that edits the glossary (the *Modal shell* row).
  - #179 alone edits `index.css`, removing the `toast-in` keyframe.
  - #181 alone appends to `motion.css`, adding the view-transition rules.
  - #180 alone edits `Sidebar.tsx`, `AgentPanel.tsx`, `EditorTabs.tsx`, `Viewer.tsx` and
    `HomeSurface.tsx`, and it creates `src/lib/layout/panel-widths.ts`.
- **Wave 3 — #182, #183.**
  - #182 alone edits the glossary, `Layout.tsx`, `app-store.ts`, `settings.rs` and
    `panel-widths.ts`.
  - #183 alone edits the tree rows, the tab chips, the transcript, `chat-store.ts` and
    `ChatHistoryList.tsx`.

## Cross-Slice Contracts

- **#177 exports** `DURATION`, `EASE`, `EXIT_RATIO`, `enterTransition` and `exitTransition`, plus
  `useExitPhase` and `ExitPhaseProps`, `scrimVariants`, `risingPanelVariants`, `anchoredVariants`,
  `overlayPresence` and `OVERLAY_SHIFT_PX`.
- **#180 defines** `SIDEBAR_DEFAULT_WIDTH`, `AGENT_DEFAULT_WIDTH`, `RAIL_WIDTH`,
  `EffectivePanelWidths`, `sidebarRenderedWidth` and `usePanelWidths()`. #182 reimplements
  `usePanelWidths()` behind the same signature.
- **#181 adds** `src/lib/motion/smooth-scroll.ts`, which #183 reuses for the chat auto-scroll.

## Decisions Taken During Breakdown

- **Toasts stack at `z-30`**, above the modal and finder scrims (#179). This makes the
  `Layout.tsx` comment true without editing that file.
- **Chat history rows get the tree's pointer-only hover layer** (#183), and drop their
  text-colour hover.

## Manual Checks

- **#180:** measure the CodeMirror re-wrap cost of the 240ms width tween on WKWebView (Web
  Inspector Timelines; jank means any tween frame over 33ms). If it janks, the fallback returns to
  the user as a decision.
- **Every child** lists manual smoke steps in `pnpm tauri dev`, and a headless run cannot perform
  them. On `/supervise-epic` they belong to the human gate.
