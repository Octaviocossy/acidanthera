import type { UnlistenFn } from '@tauri-apps/api/event';
import { agentProcessService } from '@/services/agent-process.service';
import type { AgentBackend } from '../agent-backend';
import type { AgentEvent, AgentSource } from '../agent-event';

const CLAUDE_COMMAND = 'claude';
/** `-p` streaming headless mode (doc/v0-spec.md §4.4), scoped to read/write tools inside the vault. */
const CLAUDE_ARGS = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--allowedTools', 'Read,Write,Edit,Glob,Grep'];

/**
 * Shapes below are pinned against a real captured `claude -p --output-format stream-json`
 * stream (Claude Code 2.1.204) — the spec flags this as resolved during implementation
 * (doc/v0-spec.md §4.4, §8). Only the fields this adapter reads are declared; everything else
 * in the native stream (usage, cost, session bookkeeping, `system`/`rate_limit_event` lines) is
 * intentionally ignored, per the rule that only `AgentEvent` leaves this file.
 */
interface ClaudeContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

interface ClaudeStreamLine {
  type: string;
  message?: { id?: string; content?: ClaudeContentBlock[] };
  subtype?: string;
  is_error?: boolean;
  result?: string;
}

/**
 * Claude Code adapter (doc/v0-spec.md §4.4): translates its native `stream-json` output into
 * `AgentEvent`s. The chat panel never sees `ClaudeStreamLine` — only what this module emits.
 */
export function createClaudeCodeBackend(): AgentBackend {
  const toolNamesByCallId = new Map<string, string>();
  const unlistenFns: UnlistenFn[] = [];
  let messageSeq = 0;

  function nextMessageId(): string {
    messageSeq += 1;
    return `claude-code-${messageSeq}`;
  }

  function translateAssistantLine(line: ClaudeStreamLine, source: AgentSource, timestamp: number, emit: (event: AgentEvent) => void): void {
    const blocks = line.message?.content ?? [];

    const text = blocks
      .filter((block) => block.type === 'text' || block.type === 'thinking')
      .map((block) => block.text ?? block.thinking ?? '')
      .join('');
    if (text.length > 0) {
      emit({ type: 'agent_message', messageId: nextMessageId(), text, timestamp, source });
    }

    for (const block of blocks) {
      if (block.type === 'tool_use' && block.id && block.name) {
        toolNamesByCallId.set(block.id, block.name);
        emit({ type: 'tool_call_start', callId: block.id, toolName: block.name, args: block.input ?? {}, timestamp, source });
      }
    }
  }

  function translateUserLine(line: ClaudeStreamLine, source: AgentSource, timestamp: number, emit: (event: AgentEvent) => void): void {
    const blocks = line.message?.content ?? [];
    for (const block of blocks) {
      if (block.type !== 'tool_result' || !block.tool_use_id) continue;
      const isError = block.is_error === true;
      emit({
        type: 'tool_call_result',
        callId: block.tool_use_id,
        toolName: toolNamesByCallId.get(block.tool_use_id) ?? 'unknown',
        status: isError ? 'error' : 'ok',
        result: isError ? undefined : block.content,
        errorMessage: isError ? String(block.content ?? 'Tool call failed.') : undefined,
        timestamp,
        source,
      });
    }
  }

  function translateResultLine(line: ClaudeStreamLine, source: AgentSource, timestamp: number, emit: (event: AgentEvent) => void): void {
    if (line.is_error) {
      emit({ type: 'error', message: line.result ?? `Claude Code turn failed (${line.subtype ?? 'unknown'}).`, timestamp, source });
    } else {
      emit({ type: 'turn_done', metadata: { subtype: line.subtype }, timestamp, source });
    }
  }

  function translate(line: ClaudeStreamLine, source: AgentSource, emit: (event: AgentEvent) => void): void {
    const timestamp = Date.now();
    if (line.type === 'assistant') translateAssistantLine(line, source, timestamp, emit);
    else if (line.type === 'user') translateUserLine(line, source, timestamp, emit);
    else if (line.type === 'result') translateResultLine(line, source, timestamp, emit);
  }

  return {
    id: 'claude-code',
    label: 'Claude Code',

    async start(cwd, onEvent) {
      const unlistenStdout = await agentProcessService.onStdout((raw) => {
        let line: ClaudeStreamLine;
        try {
          line = JSON.parse(raw);
        } catch {
          return;
        }
        translate(line, 'claude-code', onEvent);
      });
      const unlistenExit = await agentProcessService.onExit(() => {
        onEvent({ type: 'error', message: 'Claude Code process exited unexpectedly.', timestamp: Date.now(), source: 'claude-code' });
      });
      unlistenFns.push(unlistenStdout, unlistenExit);

      await agentProcessService.spawn(CLAUDE_COMMAND, CLAUDE_ARGS, cwd);
    },

    async send(prompt) {
      const line = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } });
      await agentProcessService.send(line);
    },

    async stop() {
      for (const unlisten of unlistenFns.splice(0)) unlisten();
      await agentProcessService.stop();
    },
  };
}
