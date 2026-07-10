import type { AgentSource } from './agent-event';

/** A user-selectable LLM. The `engine` is which CLI backend runs it; `cliModel` is the
 *  exact string passed to that CLI's `--model` flag. Selecting a model selects its engine. */
export interface AgentModel {
  /** Stable id persisted in `settings.json` (`Settings.model`). */
  id: AgentModelId;
  /** Human label for the Settings model picker. */
  label: string;
  /** Which `AgentBackend` (CLI) runs this model — derived, never persisted separately. */
  engine: AgentSource;
  /** Value passed to the CLI's `--model` flag when the backend spawns. */
  cliModel: string;
}

export type AgentModelId = 'gpt-5.4-mini' | 'haiku-4.5' | 'sonnet-5' | 'gpt-5.5-fast';

export const AGENT_MODELS: readonly AgentModel[] = [
  { id: 'gpt-5.4-mini', label: 'GPT 5.4 mini', engine: 'codex', cliModel: 'gpt-5.4-mini' },
  { id: 'haiku-4.5', label: 'Haiku 4.5', engine: 'claude-code', cliModel: 'claude-haiku-4-5-20251001' },
  { id: 'sonnet-5', label: 'Sonnet 5', engine: 'claude-code', cliModel: 'claude-sonnet-5' },
  { id: 'gpt-5.5-fast', label: 'GPT 5.5 fast', engine: 'codex', cliModel: 'gpt-5.5-fast' },
];

/** Default model for a fresh install / pre-load chat state. MUST match Rust `default_model()`.
 *  NB: its engine is `codex`, which may not be installed locally — see Architecture Decisions. */
export const DEFAULT_MODEL_ID: AgentModelId = 'gpt-5.4-mini';

export function listModels(): readonly AgentModel[] {
  return AGENT_MODELS;
}

/** Looks a model up by id; `undefined` for an unknown id (e.g. a hand-edited settings file). */
export function getModel(id: string): AgentModel | undefined {
  return AGENT_MODELS.find((model) => model.id === id);
}
