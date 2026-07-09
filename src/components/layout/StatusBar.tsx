import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app-store';

/** 24px chrome strip — active region, the settings entry point (#29) + the global mode indicator (kept muted, doc/v0-spec.md §5.6). */
export function StatusBar() {
  const activeRegion = useAppStore((state) => state.activeRegion);
  const mode = useAppStore((state) => state.mode);
  const openSettings = useAppStore((state) => state.openSettings);

  return (
    <footer className="flex h-[var(--rail-status)] shrink-0 items-center justify-between border-t border-border-hairline bg-surface px-3">
      <span className="font-mono text-text-dim text-xs uppercase tracking-caps">{activeRegion}</span>
      <div className="flex items-center gap-2">
        <Button variant="quiet" size="sm" className="h-5 px-1.5 text-xs uppercase tracking-caps" aria-haspopup="dialog" onClick={openSettings}>
          settings
        </Button>
        <Badge tone="muted">{mode}</Badge>
      </div>
    </footer>
  );
}
