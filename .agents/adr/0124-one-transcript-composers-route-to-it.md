# One transcript; every composer routes to it

The home surface docks an agent composer at the bottom of the editor card, so `ChatInput` is
now mounted in two places. It is a second **composer**, never a second **transcript**:
submitting from the dock calls `openAgent()` and sends the turn into the agent panel, which
remains the only place a conversation is rendered, stored, or resumed.

This is load-bearing rather than tidy. `useChatStore.sendMessage` never reads `agentOpen` — its
only environmental requirement is `vaultRoot` — so a dock that sent without opening the panel
would start a real turn whose events stream into an unmounted transcript, with the reply
recoverable only from the chat file on disk. The panel's `if (!agentOpen) return null` is what
makes that reachable at all.

## Consequences

- A third entry point (a palette command, a keybinding) must follow the same rule: open the
  panel, then send. The store will not stop it.
- `ChatInput` gains one `placeholder` prop and nothing else — the model pill, the send control
  and the submit wiring stay identical across both mounts, so the two cannot drift apart.
- The dock is hidden while `agentOpen` is true. Two composers addressing one transcript is the
  confusion this ADR exists to prevent, not a feature.
