import { create } from 'zustand';
import type { AgentEvent, ToolCallStatus } from '@/lib/agent/agent-event';
import { getBackend } from '@/lib/agent/backend-registry';
import type { AgentModelId } from '@/lib/agent/model-catalog';
import { DEFAULT_MODEL_ID, getModel } from '@/lib/agent/model-catalog';
import { CHAT_FILE_SCHEMA, type ChatFile, deriveChatTitle, parseChatFile, serializeChatFile } from '@/lib/chat/chat-file';
import { buildResumePrompt, countMessages } from '@/lib/chat/chat-prompt';
import { chatsService } from '@/services/chats.service';
import { useAppStore } from './app-store';
import { useToastStore } from './toast-store';

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
  modelId: AgentModelId;
  items: ChatItem[];
  /** Persisted id of the current thread (`.acidanthera/chats/<id>.chat.md`); `null` until the thread is
   *  first saved. Owned here — the store, not the backend process, is the durable thread identity. */
  chatId: string | null;
  /** A loaded thread's title, preserved across re-saves; `''` means derive it from the transcript. */
  title: string;
  /** ISO-8601 timestamp the thread was first persisted, kept stable across re-saves; `null` until then. */
  createdAt: string | null;
  /** True from `sendMessage` until `turn_done`/`error` — disables `ChatInput` (doc/v0-spec.md §4.3). */
  turnActive: boolean;
  /** Whether `AgentBackend.start` has been called for the current `modelId` (multi-turn reuses the process). */
  sessionStarted: boolean;
  /** True when the running backend has no memory of this thread (loaded from disk, or the model was
   *  switched): the next turn replays the store's owned history via `buildResumePrompt` (#69). */
  pendingResume: boolean;

  setModel: (id: AgentModelId) => void;
  sendMessage: (text: string) => Promise<void>;
  /** Starts a fresh, unsaved thread — stops any running backend and clears the transcript/identity. */
  newChat: () => void;
  /** Loads a parsed saved conversation into the store and opens the chat; the next turn resumes it. */
  loadChat: (file: ChatFile) => void;
  /** Reads + parses a saved conversation by `id`, then {@link loadChat}s it; error → toast. */
  loadChatById: (id: string) => Promise<void>;
  /** Serializes the current thread and writes it to the vault's `.acidanthera/chats/` (best-effort). */
  persistCurrentChat: () => Promise<void>;
}

let itemSeq = 0;
function nextId(prefix: string): string {
  itemSeq += 1;
  return `${prefix}-${itemSeq}`;
}

let chatSeq = 0;
/** A bare, filename-safe thread id — epoch-ms + counter: unique, sortable, accepted by Rust `is_safe_id`. */
function newChatId(): string {
  chatSeq += 1;
  return `chat-${Date.now()}-${chatSeq}`;
}

/** Stops the backend for the current model if a session is running (mirrors `setModel`'s teardown). */
function stopRunningBackend(state: ChatState): void {
  if (!state.sessionStarted) return;
  const engine = getModel(state.modelId)?.engine;
  if (engine) void getBackend(engine)?.stop();
}

function applyAgentEvent(state: ChatState, event: AgentEvent): Partial<ChatState> {
  switch (event.type) {
    case 'agent_message':
      return { items: [...state.items, { kind: 'agent_message', id: event.messageId, text: event.text }] };

    // Reasoning/thinking text is intentionally not surfaced in the transcript — the chat
    // shows only the agent's final answer. Backends still emit `agent_reasoning`; discard it
    // here so the reasoning text never enters app state (trivially re-enable by appending an
    // item again). The in-flight `ThinkingIndicator` loader still conveys activity.
    case 'agent_reasoning':
      return {};

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
  modelId: DEFAULT_MODEL_ID,
  items: [],
  chatId: null,
  title: '',
  createdAt: null,
  turnActive: false,
  sessionStarted: false,
  pendingResume: false,

  setModel: (modelId) => {
    const state = get();
    if (modelId === state.modelId) return;
    stopRunningBackend(state);
    // The new engine's process has no memory of this thread — if there's prior conversation, the
    // next turn must replay the store's owned history so context carries across the model switch.
    set({ modelId, sessionStarted: false, turnActive: false, pendingResume: countMessages(state.items) > 0 });
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().turnActive) return;

    const model = getModel(get().modelId);
    if (!model) return;
    const backend = getBackend(model.engine);
    if (!backend) return;

    set((state) => ({ items: [...state.items, { kind: 'user_message', id: nextId('user'), text: trimmed }], turnActive: true }));
    // Durably capture the question before the (possibly long/failing) turn runs.
    void get().persistCurrentChat();

    try {
      if (!get().sessionStarted) {
        const vaultRoot = useAppStore.getState().vaultRoot;
        if (!vaultRoot) {
          set((state) => ({
            items: [...state.items, { kind: 'error', id: nextId('error'), message: 'Open a vault before starting a chat.' }],
            turnActive: false,
          }));
          return;
        }
        await backend.start(vaultRoot, model.cliModel, (event) => {
          set((state) => applyAgentEvent(state, event));
          // Persist the settled transcript once a turn completes (or errors) so history is durable.
          if (event.type === 'turn_done' || event.type === 'error') void get().persistCurrentChat();
        });
        set({ sessionStarted: true });
      }

      // A fresh backend has no memory of a loaded/switched thread — replay the owned history on the
      // first continued turn (#69); a live session already remembers, so send the raw text.
      let prompt = trimmed;
      if (get().pendingResume) {
        const history = get().items.slice(0, -1); // everything before the just-added user message
        prompt = buildResumePrompt(history, trimmed);
        set({ pendingResume: false });
      }

      await backend.send(prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((state) => ({
        items: [...state.items, { kind: 'error', id: nextId('error'), message: `Could not start the agent: ${message}` }],
        turnActive: false,
      }));
      void get().persistCurrentChat();
    }
  },

  newChat: () => {
    stopRunningBackend(get());
    set({ items: [], chatId: null, title: '', createdAt: null, turnActive: false, sessionStarted: false, pendingResume: false });
  },

  loadChat: (file) => {
    const state = get();
    stopRunningBackend(state);
    const model = getModel(file.meta.model);
    set({
      items: file.items,
      chatId: file.meta.id,
      title: file.meta.title,
      createdAt: file.meta.created || null,
      modelId: model?.id ?? state.modelId, // keep the current model if the file's is unknown
      turnActive: false,
      sessionStarted: false,
      pendingResume: countMessages(file.items) > 0,
    });
    useAppStore.getState().openChat();
  },

  loadChatById: async (id) => {
    try {
      const raw = await chatsService.readChat(id);
      const result = parseChatFile(raw);
      if (!result.ok) {
        useToastStore.getState().showToast(`Could not open chat: ${result.error}`, 'error');
        return;
      }
      get().loadChat(result.file);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast(`Could not open chat: ${message}`, 'error');
    }
  },

  persistCurrentChat: async () => {
    const vaultRoot = useAppStore.getState().vaultRoot;
    if (!vaultRoot) return; // no vault → nowhere to save
    const state = get();
    if (!state.items.some((item) => item.kind === 'user_message')) return; // nothing worth saving

    const now = new Date().toISOString();
    let { chatId, createdAt } = state;
    if (!chatId) {
      chatId = newChatId();
      createdAt = now;
      set({ chatId, createdAt });
    }

    const file: ChatFile = {
      meta: {
        schema: CHAT_FILE_SCHEMA,
        id: chatId,
        title: state.title || deriveChatTitle(state.items),
        model: state.modelId,
        created: createdAt ?? now,
        updated: now,
      },
      items: state.items,
    };

    try {
      await chatsService.saveChat(chatId, serializeChatFile(file));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast(`Could not save chat: ${message}`, 'error');
    }
  },
}));
