import { useEffect, useRef } from 'react';
import { ChatInput } from '@/components/ai/ChatInput';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { ToolChip, type ToolChipStatus } from '@/components/ai/ToolChip';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { type ChatItem, type ChatToolCallStatus, useChatStore } from '@/stores/chat-store';

const TOOL_CHIP_STATUS: Record<ChatToolCallStatus, ToolChipStatus> = { running: 'running', ok: 'done', error: 'error' };

function toolPath(args: Record<string, unknown>): string | undefined {
  const value = args.file_path ?? args.path ?? args.pattern;
  return typeof value === 'string' ? value : undefined;
}

function ChatItemRow({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case 'user_message':
      // biome-ignore lint/a11y/useValidAriaRole: `role` is ChatMessage's own prop (user|agent), not a DOM ARIA role.
      return <ChatMessage role="user" text={item.text} />;
    case 'agent_message':
      // biome-ignore lint/a11y/useValidAriaRole: `role` is ChatMessage's own prop (user|agent), not a DOM ARIA role.
      return <ChatMessage role="agent" text={item.text} />;
    case 'error':
      return <div className="mx-3 my-2 rounded-sm border border-border-active px-3 py-2 font-mono text-sm text-text">{item.message}</div>;
    case 'tool_call':
      return (
        <div className="px-3 py-1">
          <ToolChip verb={item.call.toolName} path={toolPath(item.call.args)} status={TOOL_CHIP_STATUS[item.call.status]} />
        </div>
      );
  }
}

/** The invocable AI chat region (doc/v0-spec.md §5.2): renders the `AgentEvent` stream as native UI. */
export function ChatPanel() {
  const chatOpen = useAppStore((state) => state.chatOpen);
  const isActive = useAppStore((state) => state.activeRegion === 'chat');
  const items = useChatStore((state) => state.items);
  const turnActive = useChatStore((state) => state.turnActive);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items]);

  if (!chatOpen) return null;

  return (
    <aside
      className={cn('flex h-full w-[var(--rail-chat)] shrink-0 flex-col border-l bg-surface', isActive ? 'border-border-active' : 'border-border-hairline')}
      aria-label="AI chat"
    >
      {/* No header chrome (#39), and the engine selector is gone — the engine is chosen only in
          Settings now. This empty band still reserves the FAB's footprint (`--rail-fab` + inset)
          so the FAB, floating top-right over the panel, never overlaps the transcript below. */}
      <div className="h-[calc(var(--rail-fab)_+_var(--space-8))] shrink-0" />

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => (
          <ChatItemRow key={item.id} item={item} />
        ))}
      </div>

      <ChatInput disabled={turnActive} onSubmit={sendMessage} />
    </aside>
  );
}
