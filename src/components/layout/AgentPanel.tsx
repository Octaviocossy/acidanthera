import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useRef } from 'react';
import { ChatHistoryList } from '@/components/ai/ChatHistoryList';
import { ChatInput } from '@/components/ai/ChatInput';
import { ChatTranscript } from '@/components/ai/ChatTranscript';
import { Button } from '@/components/ui/button';
import { useChatHistoryKeymap } from '@/hooks/use-chat-history-keymap';
import { usePanelWidths } from '@/lib/layout/panel-widths';
import { crossfadePresence, panelFramePresence } from '@/lib/motion/presence-props';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { useReleaseFocusOnExit } from '@/lib/motion/use-release-focus-on-exit';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { type ChatTab, useChatHistoryStore } from '@/stores/chat-history-store';
import { useChatStore } from '@/stores/chat-store';

/** One tab in the panel's header strip (#71). `role="tab"` overrides the button's implicit role. */
function TabButton({ tab, label, active, onSelect }: { tab: ChatTab; label: string; active: boolean; onSelect: (tab: ChatTab) => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(tab)}
      className={cn(
        'border-b pb-0.5 font-mono text-label uppercase tracking-label transition-colors duration-[var(--dur-fast)] ease-acidanthera',
        active ? 'border-border-strong text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
      )}
    >
      {label}
    </button>
  );
}

/** The px the card's `mr-2` gutter adds outside its border box: the frame opens to card + gutter, so
 *  the card lands exactly where the fixed-width aside used to sit. */
const AGENT_CARD_GUTTER = 8;

/**
 * The agent panel's clipping frame: the presence child whose width tweens from 0 to the card plus
 * its gutter while the card inside keeps a fixed width, so the transcript never re-wraps during an
 * open or close. The card is left-aligned in it, so it slides in with its hairline and radius
 * leading, like a drawer, rather than being wiped by a hard clip. Leaving, it is inert from its first
 * frame (invariant 60).
 */
function AgentPanelFrame({ cardWidth, instant, children }: { cardWidth: number; instant: boolean; children: ReactNode }) {
  const { exiting, exitPhaseProps } = useExitPhase();
  const presence = panelFramePresence(cardWidth + AGENT_CARD_GUTTER, instant);
  return (
    <motion.div
      className="flex h-full shrink-0 overflow-hidden"
      style={{ ...exitPhaseProps.style }}
      inert={exitPhaseProps.inert}
      aria-hidden={exiting}
      initial={presence.initial}
      animate={presence.animate}
      exit={presence.exit}
    >
      {children}
    </motion.div>
  );
}

/** One tab's content as an `AnimatePresence` child: Chat and History crossfade with both present
 *  (decision 22). The outgoing layer is inert, and a focused composer inside it is blurred
 *  (invariant 60). The History keymap already gates on the store's `tab`, so keys move at once. */
function AgentTabLayer({ children }: { children: ReactNode }) {
  const { exiting, exitPhaseProps } = useExitPhase();
  const ref = useRef<HTMLDivElement>(null);
  useReleaseFocusOnExit(ref, exiting);
  return (
    <motion.div
      ref={ref}
      className="absolute inset-0 flex min-h-0 flex-1 flex-col"
      style={exitPhaseProps.style}
      inert={exitPhaseProps.inert}
      initial={crossfadePresence.initial}
      animate={crossfadePresence.animate}
      exit={crossfadePresence.exit}
    >
      {children}
    </motion.div>
  );
}

/** The invocable AI agent region (doc/v0-spec.md §5.2): a two-tab surface (#71) — the live `AgentEvent`
 *  transcript, plus a keyboard-navigable list of the conversations saved under `.acidanthera/chats/`.
 *  The region and the panel are named *agent*; the transcript it renders stays *chat* (glossary:
 *  *Agent panel*), which is why every store, item and child component below keeps the old name.
 *  `AgentPanel` stays mounted whether or not the panel is open, so every hook keeps running
 *  (`useChatHistoryKeymap` is gated on `activeRegion === 'agent'`); only the card is a presence
 *  child, and a leaving card is inert, so there is still one transcript. */
export function AgentPanel() {
  useChatHistoryKeymap();

  const agentOpen = useAppStore((state) => state.agentOpen);
  const isActive = useAppStore((state) => state.activeRegion === 'agent');
  const focusRegion = useAppStore((state) => state.focusRegion);
  const turnActive = useChatStore((state) => state.turnActive);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const newChat = useChatStore((state) => state.newChat);
  const tab = useChatHistoryStore((state) => state.tab);
  const setTab = useChatHistoryStore((state) => state.setTab);

  const panelWidths = usePanelWidths();
  const reduceMotion = useReducedMotion();
  const instantWidth = reduceMotion === true || panelWidths.dragging === 'agent';

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
    <AnimatePresence initial={false}>
      {agentOpen && (
        <AgentPanelFrame cardWidth={panelWidths.agent} instant={instantWidth}>
          {/* The agent *inset card*: the same `--bg-canvas` card on the same `--bg-panel` ground as the
              editor, so the two read as two cards on one surface (spec decision 21). Its border carries the
              focus region on all four sides; hairline in both themes, never a shadow (decisions 22, 38). */}
          <aside
            className={cn('mr-2 my-2 flex shrink-0 flex-col overflow-hidden rounded-panel border bg-canvas mt-[]', isActive ? 'border-border-strong' : 'border-hairline')}
            style={{ width: panelWidths.agent }}
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

            <div className="relative min-h-0 flex-1">
              <AnimatePresence initial={false}>
                {tab === 'chat' ? (
                  <AgentTabLayer key="chat">
                    <ChatTranscript />
                    <ChatInput disabled={turnActive} onSubmit={sendMessage} />
                  </AgentTabLayer>
                ) : (
                  <AgentTabLayer key="history">
                    <div role="tabpanel" aria-label="History" className="min-h-0 flex-1 overflow-y-auto">
                      <ChatHistoryList />
                    </div>
                  </AgentTabLayer>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </AgentPanelFrame>
      )}
    </AnimatePresence>
  );
}
