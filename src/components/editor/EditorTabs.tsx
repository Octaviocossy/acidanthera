import { FileText, Icon, X } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import type { EditorBuffer } from '@/stores/editor-store';

/**
 * How much horizontal room the native traffic lights need, measured from the window's left edge.
 *
 * `trafficLightPosition` is static config with no runtime setter in tauri 2.11.5, so the lights
 * cannot move when the sidebar collapses to 40px. Insetting this strip's left edge is the only
 * lever (spec decision 17, ADR 0035).
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

const SIDEBAR_WIDTH_EXPANDED = 224;
const SIDEBAR_WIDTH_COLLAPSED = 40;

interface EditorTabsProps {
  buffers: readonly EditorBuffer[];
  activeBufferId: string | null;
  onActivate: (bufferId: string) => void;
  onClose: (bufferId: string) => void;
}

/**
 * The viewer's *chrome strip*: accessible session-buffer navigation, kept separate from the
 * mounted editor views, on the 40px band the dissolved title bar used to occupy (ADR 0035).
 *
 * It reserves its height even at zero buffers so the *inset card* below it never slides up under
 * the traffic lights (decision 18), and carries the window drag region so the window drags from
 * here as well as from the sidebar's strip (decision 31). Tabs stay clickable through Tauri's
 * clickable-tag exemption — the drag attribute never goes on a button.
 *
 * Tabs are **detached** `--radius-tab` chips on the panel ground (decision 20): the card is inset
 * on all four sides, so the negative-margin trick that used to fuse the active tab into the canvas
 * has no shared edge left to erase, and the strip needs no seam of its own.
 */
export function EditorTabs({ buffers, activeBufferId, onActivate, onClose }: EditorTabsProps) {
  const sidebarExpanded = useAppStore((state) => state.sidebarExpanded);
  const sidebarWidth = sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;
  const leftInset = Math.max(0, TRAFFIC_LIGHT_CLEARANCE - sidebarWidth);

  return (
    <div
      role="tablist"
      aria-label="Open files"
      data-tauri-drag-region="deep"
      className="flex h-[var(--rail-titlebar)] shrink-0 items-center gap-1 overflow-x-auto bg-panel pr-2"
      style={{ paddingLeft: leftInset }}
    >
      {buffers.map((buffer) => {
        const active = buffer.id === activeBufferId;
        return (
          <div
            key={buffer.id}
            className={cn('group flex shrink-0 items-center rounded-tab border border-transparent', active ? 'border-hairline bg-canvas text-text-primary' : 'text-text-muted')}
          >
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
            <button
              type="button"
              className={cn(
                'px-2 text-text-muted outline-none transition-opacity duration-[var(--dur)] ease-acidanthera hover:text-text-primary focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-border-strong',
                !active && 'opacity-0 group-hover:opacity-100'
              )}
              aria-label={`Close ${buffer.title}`}
              onClick={() => onClose(buffer.id)}
            >
              <Icon icon={X} size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
