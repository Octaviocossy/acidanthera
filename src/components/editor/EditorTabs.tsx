import { AnimatePresence, motion, useReducedMotion, useTransform } from 'motion/react';
import { useRef } from 'react';
import { ViewToggle } from '@/components/editor/ViewToggle';
import { FileText, Icon, X } from '@/components/ui/icon';
import { sidebarRenderedWidth } from '@/lib/layout/panel-widths';
import { collapsePresence } from '@/lib/motion/presence-props';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { useReleaseFocusOnExit } from '@/lib/motion/use-release-focus-on-exit';
import { cn } from '@/lib/utils';
import type { EditorBuffer } from '@/stores/editor-store';

/**
 * How much horizontal room the native traffic lights need, measured from the window's left edge.
 *
 * `trafficLightPosition` is static config with no runtime setter in tauri 2.11.5, so the lights
 * cannot move when the sidebar collapses to 40px. Insetting this strip's left edge is the only
 * lever (spec decision 17, ADR 0121).
 *
 * Measured from a screenshot of this build, never derived. The three buttons occupy x 14-27,
 * 37-50 and 60-73, i.e. centres 20.5 / 43.5 / 66.5 at **23px** spacing, so the zoom button's
 * right edge is 73. Re-measuring is not ceremony: the arithmetic has been wrong twice — #131
 * assumed the `x` origin and #144 assumed 20px spacing and landed 6px short — and it happened
 * to agree only because `trafficLightPosition.x` moved 9 → 14 and the cluster shifted rigidly.
 *
 * 73 + 14 = 87, the 14px being the sidebar's own horizontal padding (`px-[14px]`), so the first
 * tab clears the lights by the same gutter every other sidebar row uses — and, since `x` is now
 * that same 14, the lights start in that gutter too rather than hugging the window edge.
 */
const TRAFFIC_LIGHT_CLEARANCE = 87;

/** How far the strip's first tab must move right to clear the traffic lights, given the sidebar's rendered width. */
function trafficLightInset(sidebarWidth: number): number {
  return Math.max(0, TRAFFIC_LIGHT_CLEARANCE - sidebarWidth);
}

interface EditorTabsProps {
  buffers: readonly EditorBuffer[];
  activeBufferId: string | null;
  onActivate: (bufferId: string) => void;
  onClose: (bufferId: string) => void;
}

const CHIP_PRESENCE = { full: collapsePresence('width', false), reduced: collapsePresence('width', true) };

/**
 * One chip as an `AnimatePresence` child (decision 15). Opening a buffer is a hot path, so the
 * editor appears in frame 0 and only the chip enters. It widens in, and on close collapses its
 * width in flow, which is what slides its neighbours into the gap. The spacing is the wrapper's
 * `pr-1` rather than the tablist's `gap`, so a collapsing chip takes its gap with it. It is inert
 * from its first exit frame (invariant 60).
 */
function EditorTabChip({
  buffer,
  active,
  onActivate,
  onClose,
}: {
  buffer: EditorBuffer;
  active: boolean;
  onActivate: (bufferId: string) => void;
  onClose: (bufferId: string) => void;
}) {
  const reduceMotion = useReducedMotion() === true;
  const { exiting, exitPhaseProps } = useExitPhase();
  const ref = useRef<HTMLDivElement>(null);
  useReleaseFocusOnExit(ref, exiting);
  const presence = reduceMotion ? CHIP_PRESENCE.reduced : CHIP_PRESENCE.full;
  return (
    <motion.div
      ref={ref}
      className="shrink-0 overflow-hidden pr-1"
      style={exitPhaseProps.style}
      inert={exitPhaseProps.inert}
      initial={presence.initial}
      animate={presence.animate}
      exit={presence.exit}
    >
      <div className={cn('group flex shrink-0 items-center rounded-tab border border-transparent', active ? 'border-hairline bg-canvas text-text-primary' : 'text-text-muted')}>
        <button
          type="button"
          role="tab"
          aria-selected={active}
          aria-controls={`editor-buffer-${buffer.id}`}
          aria-label={buffer.dirty ? `${buffer.title}, unsaved changes` : buffer.title}
          className="flex items-center gap-2 px-[14px] py-[7px] font-mono text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
          onClick={() => onActivate(buffer.id)}
        >
          {/* Every chip carries the file icon, reversing the icon clause of decision 42: an
              active-only icon changes the chip's width on activation, reflowing the whole strip
              on every tab switch. The icon inherits the chip's colour, so it dims with the label
              rather than encoding active/inactive a fourth time. The `×` stays hover-only on an
              inactive chip — that half of decision 42 is what its noise rationale supports — and
              the dirty dot is untouched, being one of the two indicators invariant 21 permits
              the ember. */}
          <Icon icon={FileText} size={15} />
          <span>{buffer.title}</span>
          {buffer.dirty && <span aria-hidden="true" className="h-[6px] w-[6px] rounded-pill bg-accent" />}
        </button>
        {/* Keyed on `active`: the active swap has no transition (decision 3), and a fresh node per
            activation is what keeps a fade from one activation ever carrying into the next. */}
        <button
          key={active ? 'active' : 'inactive'}
          type="button"
          className={cn(
            'px-2 text-text-muted outline-none hover:text-text-primary focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-border-strong',
            !active && 'opacity-0 transition-opacity duration-[var(--dur-fast)] ease-acidanthera group-hover:opacity-100'
          )}
          aria-label={`Close ${buffer.title}`}
          onClick={() => onClose(buffer.id)}
        >
          <Icon icon={X} size={16} />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * The viewer's *chrome strip*: accessible session-buffer navigation, kept separate from the
 * mounted editor views, on the 40px band the dissolved title bar used to occupy (ADR 0121).
 *
 * It reserves its height even at zero buffers so the *inset card* below it never slides up under
 * the traffic lights (decision 18), and carries the window drag region so the window drags from
 * here as well as from the sidebar's strip (decision 31). Tabs stay clickable through Tauri's
 * clickable-tag exemption — the drag attribute never goes on a button.
 *
 * Tabs are **detached** `--radius-tab` chips on the panel ground (decision 20): the card is inset
 * on all four sides, so the negative-margin trick that used to fuse the active tab into the canvas
 * has no shared edge left to erase, and the strip needs no seam of its own.
 *
 * The strip is a row of two, not one scroller: the tab list scrolls, and the *view toggle* sits in
 * a `shrink-0` sibling beside it. Appending the toggle to the scroller instead would scroll it out
 * of reach at the eighth tab — a control that acts on what the window is showing has to stay put.
 */
export function EditorTabs({ buffers, activeBufferId, onActivate, onClose }: EditorTabsProps) {
  // Per frame from the sidebar's *rendered* width, never from the expanded/collapsed flag: that flag
  // flips at a tween's first frame, so an inset keyed on it would jump 47px while the sidebar is
  // still 224px wide. No React re-render per frame — the MotionValue writes the style.
  const leftInset = useTransform(sidebarRenderedWidth, trafficLightInset);

  return (
    <motion.div data-tauri-drag-region="deep" className="flex h-[var(--rail-titlebar)] shrink-0 items-center bg-panel" style={{ paddingLeft: leftInset }}>
      <div role="tablist" aria-label="Open files" data-tauri-drag-region="deep" className="flex min-w-0 flex-1 items-center overflow-x-auto">
        <AnimatePresence initial={false}>
          {buffers.map((buffer) => (
            <EditorTabChip key={buffer.id} buffer={buffer} active={buffer.id === activeBufferId} onActivate={onActivate} onClose={onClose} />
          ))}
        </AnimatePresence>
      </div>
      {/* Outside the scroller, so enough open tabs scroll the list without taking the toggle with
          them. It draws nothing at all when no vault buffer is active. */}
      <div className="flex shrink-0 items-center pr-2">
        <ViewToggle />
      </div>
    </motion.div>
  );
}
