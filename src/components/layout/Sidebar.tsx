import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

/** Placeholder vault explorer region — replaced by the sidebar slice's `FileTreeItem` list. */
export function Sidebar() {
  const isActive = useAppStore((state) => state.activeRegion === 'sidebar');

  return (
    <aside
      className={cn('flex h-full w-[var(--rail-sidebar)] shrink-0 flex-col border-r bg-surface', isActive ? 'border-border-active' : 'border-border-hairline')}
      aria-label="Vault explorer"
    >
      <div className="px-3 py-2 font-mono text-text-faint text-xs uppercase tracking-caps">Vault</div>
    </aside>
  );
}
