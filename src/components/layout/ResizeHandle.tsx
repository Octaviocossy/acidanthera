import { motion, useTransform } from 'motion/react';
import { type PointerEvent, useEffect, useRef } from 'react';
import {
  AGENT_DEFAULT_WIDTH,
  CARD_GUTTER,
  RAIL_WIDTH,
  readPanelWidths,
  resolveAgentDrag,
  resolveSidebarDrag,
  SIDEBAR_DEFAULT_WIDTH,
  sidebarRenderedWidth,
  usePanelWidths,
} from '@/lib/layout/panel-widths';
import { cn } from '@/lib/utils';
import { type ResizablePanel, useAppStore } from '@/stores/app-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useToastStore } from '@/stores/toast-store';

/** The zone is 8px (`w-2`), centred on its seam (decision 10). */
const HANDLE_HALF_WIDTH = 4;

interface DragSession {
  pointerId: number;
  startX: number;
  /** The panel's width as rendered at the press; the rail's 40 when the sidebar is collapsed. */
  startWidth: number;
  moved: boolean;
}

/** Writes a *panel width* preference unless it already holds `width`, through the same
 *  `updateSettings` the zoom commands use (ADR 0101: the file is authoritative). */
function writePanelWidth(panel: ResizablePanel, width: number): void {
  const settings = useSettingsStore.getState().settings;
  const current = panel === 'sidebar' ? (settings?.sidebarWidth ?? SIDEBAR_DEFAULT_WIDTH) : (settings?.agentWidth ?? AGENT_DEFAULT_WIDTH);
  if (current === width) return;
  useSettingsStore
    .getState()
    .updateSettings(panel === 'sidebar' ? { sidebarWidth: width } : { agentWidth: width })
    .catch((error: unknown) => {
      useToastStore.getState().showToast(`Could not save the panel width: ${error instanceof Error ? error.message : String(error)}`, 'error');
    });
}

/**
 * The *resize handle* (spec 2026-09-26, decisions 6, 9, 10, 12, 23): a mouse-only 8px zone on a
 * seam — the expanded sidebar's or the rail's right edge, or the agent panel's left edge.
 * Invisible until hovered, then `col-resize` and a 1px `--border-strong` line, **never ember**
 * (invariant 21). Not focusable and `aria-hidden`: there is no keyboard resize (decision 6).
 * A drag follows the pointer 1:1 and writes the *panel width* on release; a double click resets it.
 * Rendered by `Layout` after the regions and before every overlay with **no z-index**, so DOM order
 * alone puts it above the cards and beneath every scrim (invariant 25). Starts below the *chrome
 * strip*, which keeps its window drag and holds no control of this kind (invariant 23). Absent
 * while `settings.toml` is unwritable, as the *theme toggle* is disabled then.
 */
export function ResizeHandle({ panel }: { panel: ResizablePanel }) {
  const agentOpen = useAppStore((state) => state.agentOpen);
  const live = useAppStore((state) => state.resizeDrag?.panel === panel);
  const blocked = useSettingsStore((state) => state.settings === null || state.diagnostics.some((diagnostic) => diagnostic.kind === 'syntax'));
  const { agent } = usePanelWidths();
  const sidebarLeft = useTransform(sidebarRenderedWidth, (width) => width - HANDLE_HALF_WIDTH);
  const sessionRef = useRef<DragSession | null>(null);
  const hidden = blocked || (panel === 'agent' && !agentOpen);

  // A handle that stops rendering mid-drag (settings became unwritable) never receives its
  // pointerup, so it ends the drag itself, writing nothing.
  useEffect(() => {
    if (!hidden) return;
    sessionRef.current = null;
    const { resizeDrag, setResizeDrag } = useAppStore.getState();
    if (resizeDrag?.panel === panel) setResizeDrag(null);
  }, [hidden, panel]);

  if (hidden) return null;

  const startDrag = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const widths = readPanelWidths();
    const startWidth = panel === 'agent' ? widths.agent : useAppStore.getState().sidebarExpanded ? widths.sidebar : RAIL_WIDTH;
    sessionRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth, moved: false };
  };

  const followPointer = (event: PointerEvent) => {
    const session = sessionRef.current;
    if (session === null || event.pointerId !== session.pointerId) return;
    const delta = event.clientX - session.startX;
    if (!session.moved && delta === 0) return;
    session.moved = true;
    const app = useAppStore.getState();
    if (panel === 'agent') {
      // Its edge is the left one, so dragging left widens it.
      app.setResizeDrag({ panel: 'agent', width: resolveAgentDrag(session.startWidth - delta) });
      return;
    }
    const next = resolveSidebarDrag(session.startWidth + delta);
    if (!next.expanded) {
      // `collapseSidebar` ends the drag in the same update, so the snap tweens (decision 12) and
      // the region leaves 'sidebar' (invariant 24).
      if (app.sidebarExpanded) app.collapseSidebar();
      return;
    }
    // The drag lands before the expansion, so a rail dragged out follows the pointer at once.
    app.setResizeDrag({ panel: 'sidebar', width: next.width });
    if (!app.sidebarExpanded) app.expandSidebar();
  };

  const endDrag = () => {
    const session = sessionRef.current;
    if (session === null) return;
    sessionRef.current = null;
    const { sidebarExpanded, resizeDrag, setResizeDrag } = useAppStore.getState();
    if (session.moved && (panel === 'agent' || sidebarExpanded)) {
      const widths = readPanelWidths();
      const released = panel === 'agent' ? widths.agent : widths.sidebar;
      // Before the drag clears: `updateSettings` applies synchronously, so no frame shows the old width.
      if (released !== session.startWidth) writePanelWidth(panel, released);
    }
    if (resizeDrag !== null) setResizeDrag(null);
  };

  const resetWidth = () => {
    if (panel === 'agent') {
      writePanelWidth('agent', AGENT_DEFAULT_WIDTH);
      return;
    }
    // The rail has no panel width, so a double click on it resets nothing.
    if (useAppStore.getState().sidebarExpanded) writePanelWidth('sidebar', SIDEBAR_DEFAULT_WIDTH);
  };

  return (
    <motion.div
      data-resize-handle={panel}
      aria-hidden="true"
      className="group absolute top-[var(--rail-titlebar)] bottom-0 w-2 cursor-col-resize"
      style={panel === 'sidebar' ? { left: sidebarLeft } : { right: agent + CARD_GUTTER - HANDLE_HALF_WIDTH }}
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={startDrag}
      onPointerMove={followPointer}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={resetWidth}
    >
      <div
        className={cn('mx-auto h-full w-px transition-colors duration-0', live ? 'bg-border-strong' : 'bg-transparent delay-0 group-hover:bg-border-strong group-hover:delay-150')}
      />
      {/* Holds `col-resize` wherever the pointer travels mid-drag, and keeps hover styles off what it crosses. */}
      {live && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </motion.div>
  );
}
