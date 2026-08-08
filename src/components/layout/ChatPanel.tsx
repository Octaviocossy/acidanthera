import { useEffect, useRef } from 'react';
import { ChatHistoryList } from '@/components/ai/ChatHistoryList';
import { ChatInput } from '@/components/ai/ChatInput';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { ThinkingIndicator } from '@/components/ai/ThinkingIndicator';
import { ToolChip, type ToolChipStatus } from '@/components/ai/ToolChip';
import { Button } from '@/components/ui/button';
import { useChatHistoryKeymap } from '@/hooks/use-chat-history-keymap';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { type ChatTab, useChatHistoryStore } from '@/stores/chat-history-store';
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
      return <div className="mx-4 my-3 rounded-sm border border-border-active px-3 py-2 font-mono text-sm text-text">{item.message}</div>;
    case 'tool_call':
      return (
        <div className="px-4 py-2">
          <ToolChip verb={item.call.toolName} path={toolPath(item.call.args)} status={TOOL_CHIP_STATUS[item.call.status]} />
        </div>
      );
  }
}

/** One tab in the panel's header strip (#71). `role="tab"` overrides the button's implicit role. */
function TabButton({ tab, label, active, onSelect }: { tab: ChatTab; label: string; active: boolean; onSelect: (tab: ChatTab) => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(tab)}
      className={cn(
        'border-b-2 pb-0.5 font-mono text-xs uppercase tracking-caps transition-colors duration-[var(--dur)] ease-orbit',
        active ? 'border-border-active text-text' : 'border-transparent text-text-dim hover:text-text'
      )}
    >
      {label}
    </button>
  );
}

/** The invocable AI chat region (doc/v0-spec.md §5.2): a two-tab surface (#71) — the live `AgentEvent`
 *  transcript, plus a keyboard-navigable list of the conversations saved under `.orbit/chats/`. */
export function ChatPanel() {
  useChatHistoryKeymap();

  const chatOpen = useAppStore((state) => state.chatOpen);
  const isActive = useAppStore((state) => state.activeRegion === 'chat');
  const focusRegion = useAppStore((state) => state.focusRegion);
  const items = useChatStore((state) => state.items);
  const turnActive = useChatStore((state) => state.turnActive);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const newChat = useChatStore((state) => state.newChat);
  const tab = useChatHistoryStore((state) => state.tab);
  const setTab = useChatHistoryStore((state) => state.setTab);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items, turnActive]);

  if (!chatOpen) return null;

  // Any interaction with the panel focuses the chat region so the History tab's `j`/`k` become live
  // (`openChat()` only sets `chatOpen`, never `activeRegion` — same contract the sidebar rows honor).
  const selectTab = (next: ChatTab) => {
    focusRegion('chat');
    setTab(next);
  };
  const handleNewChat = () => {
    focusRegion('chat');
    newChat();
    setTab('chat');
  };

  return (
    <aside className={cn('flex h-full w-[var(--rail-chat)] shrink-0 flex-col border-l bg-bg', isActive ? 'border-border-active' : 'border-border-hairline')} aria-label="AI chat">
      {/* Header strip (#71): the two tabs + a New chat control, left-aligned so the top-right FAB
          (floating over this band) never overlaps them. The band reserves the FAB's footprint
          (`--rail-fab` + inset). New chat starts a fresh thread (the prior one is auto-saved). */}
      <div className="flex h-[calc(var(--rail-fab)_+_var(--space-8))] shrink-0 items-center gap-4 border-b border-border-hairline px-3">
        <div role="tablist" aria-label="Chat panel" className="flex items-center gap-3">
          <TabButton tab="chat" label="Chat" active={tab === 'chat'} onSelect={selectTab} />
          <TabButton tab="history" label="History" active={tab === 'history'} onSelect={selectTab} />
        </div>
        <Button variant="ghost" size="sm" className="uppercase tracking-caps" onClick={handleNewChat}>
          New chat
        </Button>
      </div>

      {tab === 'chat' ? (
        <>
          <div ref={listRef} role="tabpanel" aria-label="Chat" className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-border-hairline">
              {items.map((item) => (
                <ChatItemRow key={item.id} item={item} />
              ))}
              {turnActive && <ThinkingIndicator />}
            </div>
          </div>
          <ChatInput disabled={turnActive} onSubmit={sendMessage} />
        </>
      ) : (
        <div role="tabpanel" aria-label="History" className="min-h-0 flex-1 overflow-y-auto">
          <ChatHistoryList />
        </div>
      )}
    </aside>
  );
}
