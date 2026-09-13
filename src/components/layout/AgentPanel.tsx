import { useEffect, useRef } from 'react';
import { ChatHistoryList } from '@/components/ai/ChatHistoryList';
import { ChatInput } from '@/components/ai/ChatInput';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { ThinkingIndicator } from '@/components/ai/ThinkingIndicator';
import { ToolChip, type ToolChipStatus } from '@/components/ai/ToolChip';
import { Button } from '@/components/ui/button';
import { useChatHistoryKeymap } from '@/hooks/use-chat-history-keymap';
import { toolCallPath } from '@/lib/chat/tool-path';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { type ChatTab, useChatHistoryStore } from '@/stores/chat-history-store';
import { type ChatItem, type ChatToolCallStatus, useChatStore } from '@/stores/chat-store';

const TOOL_CHIP_STATUS: Record<ChatToolCallStatus, ToolChipStatus> = { running: 'running', ok: 'done', error: 'error' };

function ChatItemRow({ item, vaultRoot }: { item: ChatItem; vaultRoot: string | null }) {
  switch (item.kind) {
    case 'user_message':
      // biome-ignore lint/a11y/useValidAriaRole: `role` is ChatMessage's own prop (user|agent), not a DOM ARIA role.
      return <ChatMessage role="user" text={item.text} />;
    case 'agent_message':
      // biome-ignore lint/a11y/useValidAriaRole: `role` is ChatMessage's own prop (user|agent), not a DOM ARIA role.
      return <ChatMessage role="agent" text={item.text} />;
    case 'error':
      return <div className="mx-4 my-3 rounded-card border border-border-strong px-3 py-2 font-sans text-ui text-text-secondary">{item.message}</div>;
    case 'tool_call':
      return (
        <div className="px-4 py-2">
          <ToolChip verb={item.call.toolName} path={toolCallPath(item.call.args, vaultRoot)} status={TOOL_CHIP_STATUS[item.call.status]} />
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
        'border-b pb-0.5 font-mono text-label uppercase tracking-label transition-colors duration-[var(--dur)] ease-acidanthera',
        active ? 'border-border-strong text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
      )}
    >
      {label}
    </button>
  );
}

/** The invocable AI agent region (doc/v0-spec.md §5.2): a two-tab surface (#71) — the live `AgentEvent`
 *  transcript, plus a keyboard-navigable list of the conversations saved under `.acidanthera/chats/`.
 *  The region and the panel are named *agent*; the transcript it renders stays *chat* (glossary:
 *  *Agent panel*), which is why every store, item and child component below keeps the old name. */
export function AgentPanel() {
  useChatHistoryKeymap();

  const agentOpen = useAppStore((state) => state.agentOpen);
  const isActive = useAppStore((state) => state.activeRegion === 'agent');
  const focusRegion = useAppStore((state) => state.focusRegion);
  const vaultRoot = useAppStore((state) => state.vaultRoot);
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

  if (!agentOpen) return null;

  // Any interaction with the panel focuses the agent region so the History tab's `j`/`k` become live
  // (`openAgent()` only sets `agentOpen`, never `activeRegion` — same contract the sidebar rows honor).
  const selectTab = (next: ChatTab) => {
    focusRegion('agent');
    setTab(next);
  };
  const handleNewChat = () => {
    focusRegion('agent');
    newChat();
    setTab('chat');
  };

  return (
    // The agent *inset card*: the same `--bg-canvas` card on the same `--bg-panel` ground as the
    // editor, so the two read as two cards on one surface (spec decision 21). Its border carries the
    // focus region on all four sides; hairline in both themes, never a shadow (decisions 22, 38).
    <aside
      className={cn('mr-2 mb-2 flex w-[var(--rail-agent)] shrink-0 flex-col overflow-hidden rounded-panel border bg-canvas', isActive ? 'border-border-strong' : 'border-hairline')}
      aria-label="AI agent"
    >
      {/* Header strip (#71): tabs left, New chat right. Height is `--rail-titlebar` so it lines up
          with the viewer's tab strip on the app's 40px chrome band — the titlebar it used to line up
          with is gone (ADR 0121), and before that it was `--rail-fab` + inset only to reserve the
          footprint of the FAB that once floated over this band.
          New chat starts a fresh thread (the prior one is auto-saved). */}
      <div className="flex h-[var(--rail-titlebar)] shrink-0 items-center border-b border-hairline px-3">
        <div role="tablist" aria-label="Agent panel" className="flex items-center gap-3">
          <TabButton tab="chat" label="Chat" active={tab === 'chat'} onSelect={selectTab} />
          <TabButton tab="history" label="History" active={tab === 'history'} onSelect={selectTab} />
        </div>
        <Button variant="ghost" size="sm" className="ml-auto font-mono uppercase tracking-label" onClick={handleNewChat}>
          New chat
        </Button>
      </div>

      {tab === 'chat' ? (
        <>
          <div ref={listRef} role="tabpanel" aria-label="Chat" className="min-h-0 flex-1 overflow-y-auto">
            <div className="py-2">
              {items.map((item) => (
                <ChatItemRow key={item.id} item={item} vaultRoot={vaultRoot} />
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
