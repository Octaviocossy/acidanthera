import { Button } from '@/components/ui/button';
import { CogGlyph } from '@/components/vault/glyphs';
import { useAppStore } from '@/stores/app-store';

export function Titlebar() {
  const vaultName = useAppStore((state) => state.vaultRoot?.split('/').filter(Boolean).pop());
  const openSettings = useAppStore((state) => state.openSettings);
  const chatOpen = useAppStore((state) => state.chatOpen);
  const toggleChat = useAppStore((state) => state.toggleChat);

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
      {/* The `relative` wrapper lifts the cluster out of the header's `deep` drag region; the
          attribute itself never goes on a button. `✦` stays the raw filled character rather than a
          drawn glyph, and is the only ember pixel in the app's chrome (glossary: *chat toggle*). */}
      <div className="relative ml-auto mr-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-accent"
          aria-pressed={chatOpen}
          aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
          title="Toggle AI chat (Ctrl-w c)"
          onClick={toggleChat}
        >
          <span className="text-ui" aria-hidden="true">
            ✦
          </span>
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Settings" title="Settings (Ctrl-w s)" aria-haspopup="dialog" onClick={openSettings}>
          <CogGlyph />
        </Button>
      </div>
    </header>
  );
}
