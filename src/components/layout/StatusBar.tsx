import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/app-store';

/** 24px chrome strip — active region + the global mode indicator (kept muted, doc/v0-spec.md §5.6). */
export function StatusBar() {
  const activeRegion = useAppStore((state) => state.activeRegion);
  const mode = useAppStore((state) => state.mode);

  return (
    <footer className="flex h-[var(--rail-status)] shrink-0 items-center justify-between border-t border-border-hairline bg-surface px-3">
      <span className="font-mono text-text-dim text-xs uppercase tracking-caps">{activeRegion}</span>
      <Badge tone="muted">{mode}</Badge>
    </footer>
  );
}
