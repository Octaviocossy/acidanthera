/**
 * Central `AgentEvent` contract (doc/v0-spec.md §4.3). Every backend translates its native
 * stream into this vocabulary via an adapter; the chat panel consumes only this union and
 * never touches an engine's raw JSON.
 */

/** Which engine produced an event — for logs/debug only, never for branching UI. */
export type AgentSource = 'claude-code' | 'codex';

interface AgentEventBase {
  /** Unix epoch ms when the adapter observed this event. */
  timestamp: number;
  source: AgentSource;
}

/** Complete agent text — v0 does not stream deltas. */
export interface AgentMessageEvent extends AgentEventBase {
  type: 'agent_message';
  /** Stable id for this message; leaves the door open for a future delta-streaming evolution. */
  messageId: string;
  text: string;
}

/** Complete agent reasoning/thinking text — surfaced as its own event so the UI can render it distinctly from the final `agent_message` (#49). */
export interface AgentReasoningEvent extends AgentEventBase {
  type: 'agent_reasoning';
  /** Stable id for this reasoning chunk; mirrors `AgentMessageEvent.messageId`. */
  messageId: string;
  text: string;
}

export interface ToolCallStartEvent extends AgentEventBase {
  type: 'tool_call_start';
  /** Pairs with the matching `ToolCallResultEvent`, including for parallel tool calls. */
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export type ToolCallStatus = 'ok' | 'error';

export interface ToolCallResultEvent extends AgentEventBase {
  type: 'tool_call_result';
  callId: string;
  toolName: string;
  status: ToolCallStatus;
  /** Present when `status` is `'ok'`. */
  result?: unknown;
  /** Present when `status` is `'error'`. Does not tear down the turn — only an `error` event does. */
  errorMessage?: string;
}

/** Unused in v0 — defined for v2's per-action approval. */
export interface PermissionRequestEvent extends AgentEventBase {
  type: 'permission_request';
  requestId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface TurnDoneEvent extends AgentEventBase {
  type: 'turn_done';
  metadata?: Record<string, unknown>;
}

/** The turn failed. Distinct from a `tool_call_result` with `status: 'error'`: this tears down the turn. */
export interface AgentErrorEvent extends AgentEventBase {
  type: 'error';
  message: string;
}

export type AgentEvent = AgentMessageEvent | AgentReasoningEvent | ToolCallStartEvent | ToolCallResultEvent | PermissionRequestEvent | TurnDoneEvent | AgentErrorEvent;
