import type { AgentEvent, AgentSource } from './agent-event';

/**
 * The interface every engine — `external-CLI` (Claude Code, Codex) now, `native-provider`
 * later — implements (doc/v0-spec.md §4.1-4.2). The UI depends only on this interface and
 * never knows which engine is behind it.
 */
export interface AgentBackend {
  /** Matches the `source` on every `AgentEvent` this backend emits. */
  readonly id: AgentSource;
  /** Human-readable name for the chat's backend selector (doc/v0-spec.md §5.2). */
  readonly label: string;
  /**
   * Starts a session rooted at `cwd` (the vault root) running `model` (the backend passes it
   * to the CLI's `--model` flag), invoking `onEvent` for each normalized `AgentEvent`.
   */
  start(cwd: string, model: string, onEvent: (event: AgentEvent) => void): Promise<void>;
  /** Sends a user turn to the running session — multi-turn without relaunching the process. */
  send(prompt: string): Promise<void>;
  /** Terminates the underlying process. */
  stop(): Promise<void>;
}
