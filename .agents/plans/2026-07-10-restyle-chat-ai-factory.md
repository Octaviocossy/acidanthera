# Plan: Restyle chat & AI surface to Factory

> Status: **completed**
> Created: 2026-07-10
> Updated: 2026-07-10
> Issue: #58

## Goal

Restyle the chat / agent surface to Factory and apply the system's **accent discipline**:
signal-orange (`#ee6018`) for live status/in-flight indicators and metric-green (`#a0ca92`) for
positive/done states — used only as functional data-voice signals, never as chrome or button
fills. Replace the retired lime `--fab-accent`. Optionally apply the bone "light card on dark
ground" figure/ground move to agent messages.

## Context

- **Current state:** After #56 (merged), the chat inherits Factory colors/type. The `AiFab`
  currently renders the reserved lime accent (`--fab-accent`), which #56 aliases to
  signal-orange for one slice so this code compiles — this slice makes the switch real.
  `ToolChip` has `running`/`done`/`error` states and `ThinkingIndicator` is the in-flight loader
  — natural homes for the orange/green data-voice.
- **Depends on #56** (merged into `main`) for tokens/fonts and the restyled `Button`/`Badge`.
- Read `.agents/ubiquitous-language.md` first. Glossary-tracked: `AiFab` (+ `--fab-accent`),
  `ChatPanel`, `ChatMessage` (`role` prop, not ARIA), `ThinkingIndicator`, `ToolChip`,
  `ChatInput`, `ChatItem`. Update the glossary if the FAB accent's meaning changes.
- This is Wave 2 of epic #55 ("adopt Factory design system") — see
  `.agents/plans/2026-07-10-epic-factory-design-system.md`. Siblings #57, #59, #60 touch
  disjoint files and run in the same wave.

## Affected Files

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/components/ai/AiFab.tsx` | Swap lime `--fab-accent` → signal-orange status treatment; Factory FAB |
| MODIFY | `src/components/layout/ChatPanel.tsx` | Obsidian chat rail, hairline separators, mono eyebrow, transcript rhythm |
| MODIFY | `src/components/ai/ChatMessage.tsx` | Agent vs user turn styling; optional bone light-card for agent answers |
| MODIFY | `src/components/ai/ChatInput.tsx` | Terminal `›` prompt row — carbon well, hairline border, mono prompt |
| MODIFY | `src/components/ai/ThinkingIndicator.tsx` | In-flight loader in signal-orange (the live pulse) |
| MODIFY | `src/components/ai/ToolChip.tsx` | Status pulse: orange=running, green=done, bone/ash=idle, error=border emphasis |

## Step-by-Step Implementation

1. **AiFab** (`AiFab.tsx`): replace every `--fab-accent`/`--fab-accent-dim` reference with the
   signal-orange treatment — a 6px orange status dot / accent stroke per `DESIGN.md` Status
   Pulse, on a carbon-lift (`bg-surface`) fill with `--radius-sm`. The FAB is monochrome chrome
   with an orange *signal*, not an orange fill.
2. **ChatPanel**: obsidian canvas; the header row (post-#39, header stripped) keeps a bare mono
   eyebrow if any; transcript items separated by Factory spacing (16–24px), hairline dividers
   only; the FAB band spacer preserved.
3. **ChatMessage**: user turns stay quiet monochrome (dim label, bone text). For agent answers,
   either (a) keep dark with a hairline card border (Feature Card treatment), or (b) apply the
   bone `#eeeeee` light card with obsidian text (the signature figure/ground move) — pick one and
   be consistent; keep the `role` prop + its `biome-ignore` intact. Body copy is Geist sans; any
   label/eyebrow is Geist Mono uppercase.
4. **ChatInput**: `›` prompt glyph in warm-granite, mono; carbon-lift well; hairline border that
   shifts to bone on focus (no glow); disabled state while `turnActive` unchanged in behavior.
5. **ThinkingIndicator**: render the loader in signal-orange (the live build-state pulse) — this
   is exactly the data-voice orange is reserved for; keep it subtle (dots/bar), fade motion via
   `--dur`/`--ease`.
6. **ToolChip**: map statuses to the accent discipline — `running` → signal-orange pulse/stroke,
   `done` → metric-green, `error` → keep monochrome with a heavier ash/bone border emphasis
   (error is not a third accent color); chip is hairline-bordered, mono label, `--radius-sm`.

## Architecture Decisions

- **Accents are functional only.** Orange = live/in-flight/status; green = positive/done. Never
  a button or card fill (`DESIGN.md` Don'ts). Error stays monochrome-with-emphasis so the
  palette holds at two functional accents.
- **Lime is retired.** After this slice nothing references `--fab-accent`'s old lime; #56's alias
  can be dropped in a follow-up (note it in the glossary).
- **Figure/ground is opt-in** and localized to agent messages if used — the transcript stays
  legible, not a wall of bright cards.
- Styling only — no changes to `useChatStore`, backends, or the `AgentEvent` flow.

## Validation Criteria

- [x] `pnpm check && pnpm build` pass.
- [ ] `pnpm dev`: sending a message shows a signal-orange in-flight indicator; a running tool
      chip is orange, a completed one green; the FAB shows an orange status signal, not a lime
      accent. **Not manually verified** — this headless execution environment has no GUI/browser
      to drive the running app; the styling was verified by reading the compiled CSS output
      (`dist/assets/index-*.css` contains `#ee6018`/`#a0ca92` wired to `.text-signal`/`.bg-signal`/
      `.border-signal`/`.text-metric`/`.border-metric`) rather than by visual inspection.
- [x] Grep confirms no remaining lime usage in `ai/*`; accents appear only as signals, never as
      button/card fills.

## Open Questions

- Bone light-card vs dark hairline-card for agent messages — implementer's call for legibility;
  document the choice in the PR.
  - **Resolved:** dark hairline-card (Feature Card treatment — `border-border-hairline`,
    `rounded-md`, no fill) for agent turns; user turns stay card-less/quiet. A bone light-card
    per message would have flooded a multi-turn transcript with bright figures, working against
    the "not a wall of bright cards" guidance in Architecture Decisions above.
