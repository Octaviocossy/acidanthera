import { Button } from '@/components/ui/button';
import { Icon, Settings } from '@/components/ui/icon';
import { useChordTitle } from '@/hooks/use-chord-title';
import { useAppStore } from '@/stores/app-store';

export function Titlebar() {
  const vaultName = useAppStore((state) => state.vaultRoot?.split('/').filter(Boolean).pop());
  const openSettings = useAppStore((state) => state.openSettings);
  const chatOpen = useAppStore((state) => state.chatOpen);
  const toggleChat = useAppStore((state) => state.toggleChat);
  // Hooks at the top of the component, never inside JSX conditionals.
  const chatTitle = useChordTitle('Toggle AI chat', 'global.toggle-chat');
  const settingsTitle = useChordTitle('Settings', 'global.toggle-settings');

  return (
    <header data-tauri-drag-region="deep" className="relative flex h-[var(--rail-titlebar)] shrink-0 items-center border-b border-hairline bg-surface">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-sans font-medium text-ui text-text-primary">
        <span>acidanthera</span>
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
          title={chatTitle}
          onClick={toggleChat}
        >
          <span className="text-ui" aria-hidden="true">
            ✦
          </span>
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Settings" title={settingsTitle} aria-haspopup="dialog" onClick={openSettings}>
          <Icon icon={Settings} size={15} />
        </Button>
      </div>
    </header>
  );
}
