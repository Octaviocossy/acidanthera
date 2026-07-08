import { registerBackend } from '../backend-registry';
import { createClaudeCodeBackend } from './claude-code.backend';

/**
 * Registers every v0 `AgentBackend` with the registry — imported once for its side effect
 * (doc/v0-spec.md §5.2). Codex (#16) adds a second `registerBackend` call here with zero UI
 * changes, per the epic plan's adapter growth-point invariant.
 */
export function registerBuiltinBackends(): void {
  registerBackend(createClaudeCodeBackend());
}
