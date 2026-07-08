import { create } from 'zustand';
import type { AgentEvent, AgentSource, ToolCallStatus } from '@/lib/agent/agent-event';
import { getBackend } from '@/lib/agent/backend-registry';
import { useAppStore } from './app-store';

export type ChatToolCallStatus = ToolCallStatus | 'running';

export interface ChatToolCall {
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: ChatToolCallStatus;
  result?: unknown;
  errorMessage?: string;
}

/** One row in the chat transcript — the local half (`user_message`) plus the `AgentEvent`-derived halves (doc/v0-spec.md §5.2, §4.3). */
export type ChatItem =
  | { kind: 'user_message'; id: string; text: string }
  | { kind: 'agent_message'; id: string; text: string }
  | { kind: 'tool_call'; id: string; call: ChatToolCall }
  | { kind: 'error'; id: string; message: string };

interface ChatState {
  backendId: AgentSource;
  items: ChatItem[];
  /** True from `sendMessage` until `turn_done`/`error` — disables `ChatInput` (doc/v0-spec.md §4.3). */
  turnActive: boolean;
  /** Whether `AgentBackend.start` has been called for the current `backendId` (multi-turn reuses the process). */
  sessionStarted: boolean;

  setBackend: (id: AgentSource) => void;
  sendMessage: (text: string) => Promise<void>;
}

let itemSeq = 0;
function nextId(prefix: string): string {
  itemSeq += 1;
  return `${prefix}-${itemSeq}`;
}

function applyAgentEvent(state: ChatState, event: AgentEvent): Partial<ChatState> {
  switch (event.type) {
    case 'agent_message':
      return { items: [...state.items, { kind: 'agent_message', id: event.messageId, text: event.text }] };

    case 'tool_call_start':
      return {
        items: [...state.items, { kind: 'tool_call', id: event.callId, call: { callId: event.callId, toolName: event.toolName, args: event.args, status: 'running' } }],
      };

    case 'tool_call_result':
      return {
        items: state.items.map((item) =>
          item.kind === 'tool_call' && item.call.callId === event.callId
            ? { ...item, call: { ...item.call, status: event.status, result: event.result, errorMessage: event.errorMessage } }
            : item
        ),
      };

    case 'turn_done':
      return { turnActive: false };

    case 'error':
      return { items: [...state.items, { kind: 'error', id: nextId('error'), message: event.message }], turnActive: false };

    // Unused in v0 (doc/v0-spec.md §4.3).
    case 'permission_request':
      return {};
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  backendId: 'claude-code',
  items: [],
  turnActive: false,
  sessionStarted: false,

  setBackend: (backendId) => {
    const state = get();
    if (backendId === state.backendId) return;
    if (state.sessionStarted) void getBackend(state.backendId)?.stop();
    set({ backendId, sessionStarted: false, turnActive: false });
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().turnActive) return;

    const backend = getBackend(get().backendId);
    if (!backend) return;

    set((state) => ({ items: [...state.items, { kind: 'user_message', id: nextId('user'), text: trimmed }], turnActive: true }));

    if (!get().sessionStarted) {
      const vaultRoot = useAppStore.getState().vaultRoot;
      if (!vaultRoot) {
        set((state) => ({
          items: [...state.items, { kind: 'error', id: nextId('error'), message: 'Open a vault before starting a chat.' }],
          turnActive: false,
        }));
        return;
      }
      await backend.start(vaultRoot, (event) => set((state) => applyAgentEvent(state, event)));
      set({ sessionStarted: true });
    }

    await backend.send(trimmed);
  },
}));
