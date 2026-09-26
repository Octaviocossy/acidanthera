import { type MotionValue, motionValue } from 'motion/react';

/** The expanded sidebar's default width, in px. Mirrors `--rail-sidebar`, which no component reads any more (#182 retires it). */
export const SIDEBAR_DEFAULT_WIDTH = 224;

/** The agent card's default width, in px, excluding its 8px `mr-2` gutter. Mirrors `--rail-agent` (#182 retires it). */
export const AGENT_DEFAULT_WIDTH = 340;

/** The *sidebar rail*'s width, in px — fixed, never resized (spec decision 6). Mirrors `--rail-sidebar-collapsed`,
 *  which the rail still reads; `panel-widths.test.ts` fails if they drift. */
export const RAIL_WIDTH = 40;

/**
 * The panels' **effective** widths: what the expanded explorer and the agent card render at now,
 * after any render-time clamp. Not the persisted *panel width* preference, which only #182 reads.
 */
export interface EffectivePanelWidths {
  /** The expanded explorer's width. Never `RAIL_WIDTH`: collapsed-or-not is `sidebarExpanded`'s business. */
  sidebar: number;
  /** The agent card's width, excluding its gutter. Meaningful whether or not the panel is open. */
  agent: number;
  /** The panel a live pointer drag is resizing, or `null`. */
  dragging: 'sidebar' | 'agent' | null;
}

/**
 * The sidebar `<aside>`'s rendered width at this frame, in px: the explorer's width, the rail's 40,
 * or anything between while a tween runs. `Sidebar` is its only writer — it *is* the aside's width
 * style — and `EditorTabs` derives the traffic-light inset from it.
 *
 * Module-level rather than a store field because it changes every frame of a tween: a store would
 * re-render its readers per frame, a MotionValue re-renders nothing. It starts at the expanded
 * default because the sidebar always boots expanded (ADR 0109).
 */
export const sidebarRenderedWidth: MotionValue = motionValue(SIDEBAR_DEFAULT_WIDTH);

const DEFAULT_PANEL_WIDTHS: EffectivePanelWidths = { sidebar: SIDEBAR_DEFAULT_WIDTH, agent: AGENT_DEFAULT_WIDTH, dragging: null };

/**
 * The panels' effective widths. Until #182 lands: the defaults, and never a drag.
 *
 * Contract for #182's reimplementation (same signature; no change to `Sidebar`, `AgentPanel` or
 * `EditorTabs` may be needed):
 * - While `dragging` names a panel, that panel's width follows these numbers 1:1, with no
 *   transition (decision 12).
 * - Report `null` at every other moment, including when a drag snaps the sidebar to the rail and
 *   when a double click resets a width. Those are exactly the changes that must tween.
 * - Consumers tween every other change over `--dur-slow`, retargeting from wherever the running
 *   tween has reached. That includes a clamp that moves as the window resizes, and a preference
 *   that arrives after the first render.
 * - Consumers apply Reduce Motion themselves; this hook need not know about it.
 */
export function usePanelWidths(): EffectivePanelWidths {
  return DEFAULT_PANEL_WIDTHS;
}
