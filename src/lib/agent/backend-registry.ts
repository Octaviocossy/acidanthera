import type { AgentBackend } from './agent-backend';
import type { AgentSource } from './agent-event';

/**
 * Registry of available `AgentBackend`s, keyed by `AgentSource`. Each backend module
 * (Claude Code, later Codex) registers itself here; the chat's backend selector reads it
 * via `listBackends` (doc/v0-spec.md §5.2). Adding an engine means writing an adapter and
 * registering it — never touching the UI.
 */
const registry = new Map<AgentSource, AgentBackend>();

export function registerBackend(backend: AgentBackend): void {
  registry.set(backend.id, backend);
}

export function getBackend(id: AgentSource): AgentBackend | undefined {
  return registry.get(id);
}

export function listBackends(): AgentBackend[] {
  return Array.from(registry.values());
}
