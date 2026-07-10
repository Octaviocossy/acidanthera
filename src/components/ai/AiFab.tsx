import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

/**
 * The floating AI button — top-right monochrome chrome. When the chat is open it carries a
 * signal-orange Status Pulse dot (DESIGN.md "Status Pulse"): the FAB itself stays neutral
 * chrome, never an orange fill (accent discipline, `.agents/ubiquitous-language.md`).
 *
 * Anchored to the top-right of the content area (#39): when the chat is open it floats
 * over the panel's header-less top row; when closed it clears the Viewer's bottom-right
 * vim-mode badge, which the old bottom-right FAB overlapped.
 */
export function AiFab() {
  const chatOpen = useAppStore((state) => state.chatOpen);
  const toggleChat = useAppStore((state) => state.toggleChat);

  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-pressed={chatOpen}
      aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
      className={cn(
        'absolute top-4 right-4 flex h-[var(--rail-fab)] w-[var(--rail-fab)] items-center justify-center rounded-sm border bg-surface transition-colors duration-[var(--dur)] ease-orbit hover:border-border-active hover:text-text',
        chatOpen ? 'border-border-active text-text' : 'border-border-hairline text-text-dim'
      )}
    >
      <SparkGlyph className="h-4 w-4" />
      {chatOpen && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />}
    </button>
  );
}

function SparkGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 1.5 L9.6 6.4 L14.5 8 L9.6 9.6 L8 14.5 L6.4 9.6 L1.5 8 L6.4 6.4 Z" />
    </svg>
  );
}
