import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';

/**
 * Sends a turn typed into the *agent dock*: open the *agent panel*, then send into it (ADR 0124,
 * invariant 34). One transcript, never two — the dock is a composer, not a conversation.
 *
 * The order is load-bearing rather than tidy, which is why it lives in one named function instead
 * of at the call site: `useChatStore.sendMessage` reads only `vaultRoot` and never `agentOpen`, so
 * it will not stop a caller that gets this wrong. A composer that sent without opening would start
 * a real turn whose `AgentEvent`s stream into an unmounted transcript, recoverable only from the
 * chat file on disk.
 *
 * `openAgent` rather than `toggleAgent`, and unconditional rather than gated on `agentOpen`, so a
 * later entry point cannot invert it by arriving with the panel already open.
 */
export function submitFromDock(text: string): void {
  useAppStore.getState().openAgent();
  void useChatStore.getState().sendMessage(text);
}
