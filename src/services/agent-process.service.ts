import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

const AGENT_STDOUT_EVENT = 'agent-stdout';
const AGENT_STDERR_EVENT = 'agent-stderr';
const AGENT_EXIT_EVENT = 'agent-exit';

/**
 * Typed wrapper over the generic headless-agent process commands (doc/v0-spec.md §4.4). Spawns
 * any `external-CLI` agent by command + args + cwd and streams its stdout/stderr back line by
 * line — parsing those lines into `AgentEvent`s is each `AgentBackend`'s own adapter, never this
 * service.
 */
export const agentProcessService = {
  /** Spawns `command` with `args` rooted at `cwd`, replacing any process already running. */
  spawn: (command: string, args: string[], cwd: string): Promise<void> => invoke('agent_spawn', { command, args, cwd }),

  /** Writes a line to the running process's stdin — a user turn in the backend's own protocol. */
  send: (input: string): Promise<void> => invoke('agent_send', { input }),

  /** Terminates the running process, if any. */
  stop: (): Promise<void> => invoke('agent_stop'),

  /** Subscribes to raw stdout lines from the running process. */
  onStdout: (handler: (line: string) => void): Promise<UnlistenFn> => listen<string>(AGENT_STDOUT_EVENT, (event) => handler(event.payload)),

  /** Subscribes to raw stderr lines from the running process. */
  onStderr: (handler: (line: string) => void): Promise<UnlistenFn> => listen<string>(AGENT_STDERR_EVENT, (event) => handler(event.payload)),

  /** Subscribes to the process's stdout stream closing (it exited, killed or on its own). */
  onExit: (handler: () => void): Promise<UnlistenFn> => listen(AGENT_EXIT_EVENT, () => handler()),
};
