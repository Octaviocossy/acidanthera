/**
 * Chat prompt building & message-count truncation (epic #66 — chat management & history).
 *
 * A pure, engine-agnostic logic module: given a chat transcript (`useChatStore.items`), it can
 * (a) bound it to the last N conversational messages and (b) rebuild the prompt for a **resumed**
 * chat. Like `chat-file.ts` (#67) it owns *logic*, not *wiring* — no UI, store, filesystem, or Rust
 * changes; a later epic-#66 slice (the save/load + resume loop, #68 and beyond) consumes it.
 *
 * ## Why a "resume" prompt exists
 * During a *live* chat the running backend keeps its own conversation state — Claude Code is a
 * long-lived NDJSON process, Codex uses `exec resume <thread_id>` — so a live turn correctly sends
 * only the new user text (`AgentBackend.send`). But when a chat is **loaded from disk** after a
 * restart (#68), that process is gone: a fresh backend has *no memory* of the earlier turns. To
 * continue the conversation coherently the app replays the prior transcript into the first
 * continued turn's prompt. {@link buildResumePrompt} produces exactly that prompt.
 *
 * This module never imports a backend and never branches on `AgentSource`: it emits a plain string,
 * and which engine consumes it is not its concern (the growth-point rule, `agent-event.ts` #13).
 *
 * ## What counts as a "message"
 * A *conversational message* is a `user_message` or `agent_message` — the turns a human reads.
 * `tool_call` and `error` rows are sub-turn / structural artifacts: they do **not** count toward
 * the message limit and are **not** replayed into a resume prompt (replaying verbose tool JSON
 * would bloat the context and make the count unpredictable). {@link truncateByMessageCount} still
 * *carries* any tool/error rows that fall inside the retained window, so it stays a faithful
 * transcript primitive reusable beyond prompt building.
 */

import type { ChatItem } from '@/stores/chat-store';

/** A conversational message: the transcript variants that carry human-readable turn `text`. */
export type ConversationalMessage = Extract<ChatItem, { kind: 'user_message' | 'agent_message' }>;

/** Default cap on how many conversational messages of prior context a resume prompt replays. */
export const DEFAULT_MAX_MESSAGES = 20;

/** The `You:` / `Assistant:` role label each replayed message is rendered under. */
const ROLE_LABEL: Record<ConversationalMessage['kind'], string> = {
  user_message: 'You',
  agent_message: 'Assistant',
};

/** Default header introducing the replayed context in a resume prompt. */
const DEFAULT_HEADER = 'The following is the earlier conversation, continued from a saved chat. Use it as context for the message that follows the divider.';

/** Type guard: is this item a conversational message (user/agent), not a tool/error row? */
export function isConversationalMessage(item: ChatItem): item is ConversationalMessage {
  return item.kind === 'user_message' || item.kind === 'agent_message';
}

/** How many conversational messages (user + agent turns) a transcript holds. */
export function countMessages(items: ChatItem[]): number {
  let count = 0;
  for (const item of items) {
    if (isConversationalMessage(item)) count += 1;
  }
  return count;
}

/**
 * Keep only the most recent `maxMessages` conversational messages, dropping older turns so the
 * context stays bounded. The cut is made at the `maxMessages`-th message counted from the end, and
 * everything from there onward is kept — so interleaved `tool_call` / `error` rows that trail the
 * oldest retained message survive with it, while rows belonging to dropped turns fall away.
 *
 * Pure: always returns a fresh array and never mutates the input. `maxMessages <= 0` yields `[]`; a
 * non-integer is floored; a transcript with fewer messages than the cap is returned as a copy.
 */
export function truncateByMessageCount(items: ChatItem[], maxMessages: number = DEFAULT_MAX_MESSAGES): ChatItem[] {
  const max = Math.floor(maxMessages);
  if (max <= 0) return [];

  let seen = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    if (isConversationalMessage(items[i])) {
      seen += 1;
      if (seen === max) return items.slice(i);
    }
  }
  // Fewer than `max` messages present — nothing to drop; return a copy for purity.
  return items.slice();
}

/** Options for {@link buildResumePrompt}. */
export interface BuildResumePromptOptions {
  /** Cap on replayed conversational messages of prior context. Defaults to {@link DEFAULT_MAX_MESSAGES}. */
  maxMessages?: number;
  /** Override the header introducing the replayed context. Defaults to a built-in explanation. */
  header?: string;
}

/**
 * Build the prompt for the **first continued turn of a resumed chat**: a replay of the (truncated)
 * prior transcript, a `---` divider, then the new user message.
 *
 * Only conversational messages are replayed (see the module header). When the truncated history has
 * no conversational messages — a brand-new chat, or one holding only tool/error rows — the bare
 * trimmed `userMessage` is returned, so a fresh chat's first turn is exactly what it is today.
 *
 * Pure — no clock, no I/O, no backend import. The caller decides *when* a turn is a resume (loaded
 * chat) vs a live turn (send the raw text through the CLI's own session).
 */
export function buildResumePrompt(history: ChatItem[], userMessage: string, options: BuildResumePromptOptions = {}): string {
  const message = userMessage.trim();
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const header = options.header ?? DEFAULT_HEADER;

  const replay = truncateByMessageCount(history, maxMessages)
    .filter(isConversationalMessage)
    .map((item) => {
      const text = item.text.trim();
      return text ? `${ROLE_LABEL[item.kind]}: ${text}` : '';
    })
    .filter((block) => block.length > 0);

  if (replay.length === 0) return message;

  return `${header}\n\n${replay.join('\n\n')}\n\n---\n\n${message}`;
}
