import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

/** Placeholder AI chat region — replaced by the chat panel rendering the `AgentEvent` stream. */
export function ChatPanel() {
  const chatOpen = useAppStore((state) => state.chatOpen);
  const isActive = useAppStore((state) => state.activeRegion === 'chat');

  if (!chatOpen) return null;

  return (
    <aside
      className={cn('flex h-full w-[var(--rail-chat)] shrink-0 flex-col border-l bg-surface', isActive ? 'border-border-active' : 'border-border-hairline')}
      aria-label="AI chat"
    >
      <div className="px-3 py-2 font-mono text-text-faint text-xs uppercase tracking-caps">Chat</div>
    </aside>
  );
}
