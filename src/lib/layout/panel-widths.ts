import { type MotionValue, motionValue } from 'motion/react';
import { useSyncExternalStore } from 'react';
import { type ResizablePanel, useAppStore } from '@/stores/app-store';
import { useSettingsStore } from '@/stores/settings-store';

/** The expanded sidebar's default width, in px. Mirrors `DEFAULT_SIDEBAR_WIDTH` in `src-tauri/src/settings.rs`, kept in sync by hand. */
export const SIDEBAR_DEFAULT_WIDTH = 224;

/** The agent card's default width, in px, excluding its 8px `mr-2` gutter. Mirrors `DEFAULT_AGENT_WIDTH` in `src-tauri/src/settings.rs`. */
export const AGENT_DEFAULT_WIDTH = 340;

/** The *sidebar rail*'s width, in px — fixed, never resized (spec decision 6). Mirrors `--rail-sidebar-collapsed`,
 *  which the rail still reads; `panel-widths.test.ts` fails if they drift. */
export const RAIL_WIDTH = 40;

/** *Panel width* bounds (decisions 8, 23), mirroring `SIDEBAR_WIDTH_MIN`… in `src-tauri/src/settings.rs` by hand. */
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 420;
export const AGENT_MIN_WIDTH = 280;
export const AGENT_MAX_WIDTH = 640;
/** Below this a sidebar drag snaps to the rail: midway between the rail (40) and the minimum (decision 23). */
export const SIDEBAR_SNAP_WIDTH = 110;
/** The viewer card's soft floor (decisions 8, 27), measured on the card itself. */
export const VIEWER_MIN_WIDTH = 400;
/** The *inset card* gutter: the `mr-2` the viewer card and the agent card each carry. */
export const CARD_GUTTER = 8;

/**
 * The panels' **effective** widths: what the expanded explorer and the agent card render at now,
 * after any render-time clamp. Not the persisted *panel width* preference, which only reflects
 * what the user asked for — see `PanelWidthInput`.
 */
export interface EffectivePanelWidths {
  /** The expanded explorer's width. Never `RAIL_WIDTH`: collapsed-or-not is `sidebarExpanded`'s business. */
  sidebar: number;
  /** The agent card's width, excluding its gutter. Meaningful whether or not the panel is open. */
  agent: number;
  /** The panel a live pointer drag is resizing, or `null`. */
  dragging: ResizablePanel | null;
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
export const sidebarRenderedWidth: MotionValue<number> = motionValue(SIDEBAR_DEFAULT_WIDTH);

export interface PanelWidthInput {
  windowWidth: number;
  /** The expanded sidebar's requested width: the live drag width while dragging it, else its preference. */
  sidebar: number;
  /** The agent panel's requested width, the same way. */
  agent: number;
  sidebarExpanded: boolean;
  agentOpen: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Fits the shown panels beside a viewer card of at least `VIEWER_MIN_WIDTH`. The agent panel
 *  yields first, then the sidebar, each only down to its minimum; any shortfall left comes out of
 *  the viewer, whose floor is soft (decision 27). */
function fitPanels(input: PanelWidthInput, sidebarShown: boolean, agentShown: boolean): EffectivePanelWidths {
  let sidebar = clamp(input.sidebar, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
  let agent = clamp(input.agent, AGENT_MIN_WIDTH, AGENT_MAX_WIDTH);
  let overflow = (sidebarShown ? sidebar : RAIL_WIDTH) + VIEWER_MIN_WIDTH + CARD_GUTTER + (agentShown ? agent + CARD_GUTTER : 0) - input.windowWidth;
  if (overflow > 0 && agentShown) {
    const yielded = Math.min(overflow, agent - AGENT_MIN_WIDTH);
    agent -= yielded;
    overflow -= yielded;
  }
  if (overflow > 0 && sidebarShown) sidebar -= Math.min(overflow, sidebar - SIDEBAR_MIN_WIDTH);
  return { sidebar, agent, dragging: null };
}

/** The *effective* widths: the preference, clamped at render time only (decision 17). A hidden
 *  panel is resolved as if it were shown, so its value does not jump while it opens or closes. */
export function computeEffectiveWidths(input: PanelWidthInput): { sidebar: number; agent: number } {
  return {
    sidebar: fitPanels(input, true, input.agentOpen).sidebar,
    agent: fitPanels(input, input.sidebarExpanded, true).agent,
  };
}

export type SidebarDragResult = { expanded: false } | { expanded: true; width: number };

/** Where a sidebar drag lands for a candidate edge position: the rail below the snap threshold,
 *  otherwise the candidate held inside `[180, 420]` (decisions 9, 23). The dead zone [110, 180)
 *  holds at 180. */
export function resolveSidebarDrag(candidate: number): SidebarDragResult {
  if (candidate < SIDEBAR_SNAP_WIDTH) return { expanded: false };
  return { expanded: true, width: clamp(candidate, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH) };
}

/** The agent panel stops at its minimum rather than closing: a closed panel has no edge to drag back (decision 9). */
export function resolveAgentDrag(candidate: number): number {
  return clamp(candidate, AGENT_MIN_WIDTH, AGENT_MAX_WIDTH);
}

function currentInput(): PanelWidthInput {
  const { settings } = useSettingsStore.getState();
  const { sidebarExpanded, agentOpen, resizeDrag } = useAppStore.getState();
  return {
    windowWidth: window.innerWidth,
    sidebar: resizeDrag?.panel === 'sidebar' ? resizeDrag.width : (settings?.sidebarWidth ?? SIDEBAR_DEFAULT_WIDTH),
    agent: resizeDrag?.panel === 'agent' ? resizeDrag.width : (settings?.agentWidth ?? AGENT_DEFAULT_WIDTH),
    sidebarExpanded,
    agentOpen,
  };
}

/** `usePanelWidths`' value, read outside React (the *resize handle*'s pointer handlers). */
export function readPanelWidths(): EffectivePanelWidths {
  const { sidebar, agent } = computeEffectiveWidths(currentInput());
  return { sidebar, agent, dragging: useAppStore.getState().resizeDrag?.panel ?? null };
}

let snapshot: EffectivePanelWidths | null = null;

/** Value-compared, so a consumer re-renders only when a number it reads changes — not on every
 *  window resize or unrelated store update (`useSyncExternalStore` requires a stable snapshot). */
function getPanelWidthsSnapshot(): EffectivePanelWidths {
  const next = readPanelWidths();
  if (snapshot !== null && snapshot.sidebar === next.sidebar && snapshot.agent === next.agent && snapshot.dragging === next.dragging) return snapshot;
  snapshot = next;
  return next;
}

function subscribePanelWidths(onChange: () => void): () => void {
  const unsubscribeApp = useAppStore.subscribe(onChange);
  const unsubscribeSettings = useSettingsStore.subscribe(onChange);
  window.addEventListener('resize', onChange);
  return () => {
    unsubscribeApp();
    unsubscribeSettings();
    window.removeEventListener('resize', onChange);
  };
}

/**
 * The panels' effective widths, tracking the persisted preference, the live *resize handle* drag
 * and the window width. While `dragging` names a panel, that panel's width follows the drag 1:1,
 * with no transition (decision 12). It reports `null` at every other moment, including when a
 * drag snaps the sidebar to the rail and when a double click resets a width — those are exactly
 * the changes that must tween. Consumers tween every other change over `--dur-slow`, retargeting
 * from wherever the running tween has reached, and apply Reduce Motion themselves; this hook need
 * not know about it. The clamp order is agent, then sidebar, then the viewer (decisions 8, 27).
 */
export function usePanelWidths(): EffectivePanelWidths {
  return useSyncExternalStore(subscribePanelWidths, getPanelWidthsSnapshot);
}
