import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { ThinkingIndicator } from '@/components/ai/ThinkingIndicator';
import { ToolChip, type ToolChipStatus } from '@/components/ai/ToolChip';
import { toolCallPath } from '@/lib/chat/tool-path';
import { pendingScrollTop, settleScroll, smoothScrollTo } from '@/lib/motion/smooth-scroll';
import { useExitPhase } from '@/lib/motion/use-exit-phase';
import { overlayPresence, risingPanelVariants } from '@/lib/motion/variants';
import { useAppStore } from '@/stores/app-store';
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

/** How close to its bottom, in px, the transcript must sit for new content to be followed
 *  (decision 16; the figure is this plan's choice, about one short message). */
export const NEAR_BOTTOM_PX = 64;

/** Whether scrolling to `top` leaves `element` within {@link NEAR_BOTTOM_PX} of its bottom. */
export function isNearBottom(element: Pick<HTMLElement, 'scrollHeight' | 'clientHeight'>, top: number): boolean {
  return element.scrollHeight - element.clientHeight - top <= NEAR_BOTTOM_PX;
}

/** One transcript entry: it fades and rises 4px, #177's rising shape on the list step. It is inert once
 *  leaving (invariant 60). Only the thinking indicator ever leaves on its own; a replaced list remounts. */
function TranscriptItem({ children }: { children: ReactNode }) {
  const { exitPhaseProps } = useExitPhase();
  return (
    <motion.div variants={risingPanelVariants} {...overlayPresence} style={exitPhaseProps.style} inert={exitPhaseProps.inert}>
      {children}
    </motion.div>
  );
}

/** The agent panel's Chat tabpanel: the one transcript (invariant 34). */
export function ChatTranscript() {
  const vaultRoot = useAppStore((state) => state.vaultRoot);
  const items = useChatStore((state) => state.items);
  const turnActive = useChatStore((state) => state.turnActive);
  const generation = useChatStore((state) => state.transcriptGeneration);
  // Read once per mount, as Motion's hook does: a Reduce Motion toggle reaches a transcript mounted
  // after it (accepted limitation).
  const reduceMotion = useReducedMotion() === true;
  const listRef = useRef<HTMLDivElement>(null);
  /** Whether new content is followed, recomputed only from scroll events. */
  const following = useRef(true);
  const pinnedGeneration = useRef<number | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const bottom = list.scrollHeight - list.clientHeight; // #181's helper clamps
    // A fresh mount (panel opened, Chat tab shown) or a replaced transcript starts pinned to its
    // bottom instantly: the initial render never animates.
    if (pinnedGeneration.current !== generation) {
      pinnedGeneration.current = generation;
      following.current = true;
      smoothScrollTo(list, bottom, { reducedMotion: true });
      return;
    }
    // Motion's `reducedMotion="user"` does not cover an imperative scroll (Residual Unknowns).
    if (following.current) smoothScrollTo(list, bottom, { reducedMotion: reduceMotion });
  }, [items, turnActive, generation, reduceMotion]);

  useEffect(() => {
    const list = listRef.current;
    return () => {
      if (list !== null) settleScroll(list);
    };
  }, []);

  return (
    <div
      ref={listRef}
      role="tabpanel"
      aria-label="Chat"
      className="min-h-0 flex-1 overflow-y-auto"
      onScroll={(event) => {
        following.current = isNearBottom(event.currentTarget, pendingScrollTop(event.currentTarget));
      }}
    >
      <div className="py-2">
        <AnimatePresence key={generation} initial={false}>
          {items.map((item) => (
            <TranscriptItem key={item.id}>
              <ChatItemRow item={item} vaultRoot={vaultRoot} />
            </TranscriptItem>
          ))}
          {turnActive && (
            <TranscriptItem key="thinking-indicator">
              <ThinkingIndicator />
            </TranscriptItem>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
