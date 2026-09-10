import type { ReactNode } from 'react';
import { Icon, type LucideIcon } from '@/components/ui/icon';

/**
 * One action row of the *home surface* — a ~44px bordered row on the editor card's `--bg-canvas`,
 * sized for a ~400px centered stack.
 *
 * Deliberately neither `NavRow` nor `Button` (spec decision 9): `NavRow` is a 33px unbordered row
 * inside a 224px panel column, and `Button` is tuned for controls rather than list rows. One
 * component serving both would need props for border, height, width and ground in order to share
 * six lines of JSX.
 */
export function HomeRow({ icon, label, trailing, onSelect }: { icon: LucideIcon; label: string; trailing?: ReactNode; onSelect: () => void }) {
  return (
    <button
      type="button"
      className="flex h-11 w-full items-center gap-3 rounded-item border border-hairline px-3 text-left font-sans text-ui text-text-secondary outline-none transition-colors duration-[var(--dur)] ease-acidanthera hover:bg-hover focus-visible:ring-1 focus-visible:ring-border-strong"
      onClick={onSelect}
    >
      <Icon icon={icon} size={15} className="shrink-0" />
      {/* A clipped surface carries a hover reveal (invariant 32). The drawn *Tooltip* is scoped to
          the sidebar and this is the editor card, so the reveal is the native `title` the app's
          four other non-sidebar truncating surfaces already use. */}
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
      {trailing !== undefined && <span className="ml-auto shrink-0">{trailing}</span>}
    </button>
  );
}
