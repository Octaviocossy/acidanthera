import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';

/**
 * 24px chrome strip — active region, the sidebar toggle (#38) + settings entry point (#29),
 * and the global mode indicator (kept muted, doc/v0-spec.md §5.6).
 */
export function StatusBar() {
  const activeRegion = useAppStore((state) => state.activeRegion);
  const mode = useAppStore((state) => state.mode);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const openSettings = useAppStore((state) => state.openSettings);
  const showFileFinder = useFileFinderStore((state) => state.show);

  return (
    <footer className="flex h-[var(--rail-status)] shrink-0 items-center justify-between border-t border-border-hairline bg-surface px-3">
      <span className="font-mono text-text-dim text-xs uppercase tracking-caps">{activeRegion}</span>
      <div className="flex items-center gap-2">
        {/* The mouse entry point for `Ctrl-w b` — without it a hidden sidebar is only recoverable
            by keyboard. State reads monochrome (brighter when shown), per the accent discipline. */}
        <Button
          variant={sidebarOpen ? 'ghost' : 'quiet'}
          size="sm"
          className="h-5 px-1.5 text-xs uppercase tracking-caps"
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          onClick={toggleSidebar}
        >
          sidebar
        </Button>
        <Button variant="quiet" size="sm" className="h-5 px-1.5 text-xs uppercase tracking-caps" aria-haspopup="dialog" onClick={showFileFinder}>
          find
        </Button>
        <Button variant="quiet" size="sm" className="h-5 px-1.5 text-xs uppercase tracking-caps" aria-haspopup="dialog" onClick={openSettings}>
          settings
        </Button>
        <Badge tone="muted">{mode}</Badge>
      </div>
    </footer>
  );
}
