import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

/** The floating AI entry point, anchored over the chat panel's reserved header band. */
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
        'absolute top-4 right-4 flex h-[var(--rail-fab)] w-[var(--rail-fab)] items-center justify-center rounded-btn border bg-surface text-accent transition-colors duration-[var(--dur)] ease-orbit hover:border-border-strong',
        chatOpen ? 'border-border-strong' : 'border-border'
      )}
    >
      <span className="text-ui" aria-hidden="true">
        ✦
      </span>
    </button>
  );
}
