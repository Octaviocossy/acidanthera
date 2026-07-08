import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

/** Placeholder editor region — replaced by the CodeMirror 6 markdown editor. */
export function Viewer() {
  const isActive = useAppStore((state) => state.activeRegion === 'viewer');

  return (
    <main aria-label="Editor" className={cn('flex h-full flex-1 flex-col border-t-2 bg-bg', isActive ? 'border-border-active' : 'border-transparent')}>
      <div className="flex h-full items-center justify-center font-mono text-sm text-text-faint">No file open</div>
    </main>
  );
}
