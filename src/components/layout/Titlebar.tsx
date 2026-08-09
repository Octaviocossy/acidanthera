import { Button } from '@/components/ui/button';
import { CogGlyph } from '@/components/vault/glyphs';
import { useAppStore } from '@/stores/app-store';

export function Titlebar() {
  const vaultName = useAppStore((state) => state.vaultRoot?.split('/').filter(Boolean).pop());
  const openSettings = useAppStore((state) => state.openSettings);

  return (
    <header data-tauri-drag-region="deep" className="relative flex h-[var(--rail-titlebar)] shrink-0 items-center border-b border-hairline bg-surface">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-sans font-medium text-ui text-text-primary">
        <span>orbit</span>
        {vaultName && (
          <>
            <span> — </span>
            <span className="font-mono text-meta text-text-muted">{vaultName}</span>
          </>
        )}
      </div>
      <div className="relative ml-auto mr-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Settings" title="Settings (Ctrl-w s)" aria-haspopup="dialog" onClick={openSettings}>
          <CogGlyph />
        </Button>
      </div>
    </header>
  );
}
