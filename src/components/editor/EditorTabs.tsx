import { Icon, X } from '@/components/ui/icon';
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
 * Measured from a screenshot of this build, not derived — the derivation this replaced assumed
 * macOS spaces the buttons 20px apart centre-to-centre and was 6px short. The three buttons
 * actually measure x 9-22, 32-45 and 55-68, i.e. centres 15.5 / 38.5 / 61.5 at **23px** spacing,
 * so the zoom button's right edge is 68. The close button's 9 / 15.5 matches the figures already
 * recorded in the glossary (*traffic light inset*), which corroborates the measurement.
 *
 * 68 + 14 = 82, the 14px being the sidebar's own horizontal padding (`px-[14px]`), so the first
 * tab clears the lights by the same gutter every other sidebar row uses.
 */
const TRAFFIC_LIGHT_CLEARANCE = 82;

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
 * It reserves its height even at zero buffers so the editor never slides up under the traffic
 * lights (decision 18), and carries the window drag region so the window drags from here as well
 * as from the sidebar's strip (decision 31). Tabs stay clickable through Tauri's clickable-tag
 * exemption — the drag attribute never goes on a button.
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
      className="flex h-[var(--rail-titlebar)] shrink-0 overflow-x-auto border-b border-hairline bg-panel"
      style={{ paddingLeft: leftInset }}
    >
      {buffers.map((buffer) => {
        const active = buffer.id === activeBufferId;
        return (
          <div
            key={buffer.id}
            className={cn(
              'flex shrink-0 border border-transparent border-b-transparent',
              active && '-mb-px border-hairline border-b-canvas bg-canvas text-text-primary',
              !active && 'text-text-muted'
            )}
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
              <span>{buffer.title}</span>
              {buffer.dirty && <span aria-hidden="true" className="h-[6px] w-[6px] rounded-pill bg-accent" />}
            </button>
            <button
              type="button"
              className="px-2 text-text-muted outline-none hover:text-text-primary focus-visible:ring-1 focus-visible:ring-border-strong"
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
