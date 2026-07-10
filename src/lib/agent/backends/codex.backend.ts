import type { UnlistenFn } from '@tauri-apps/api/event';
import { agentProcessService } from '@/services/agent-process.service';
import type { AgentBackend } from '../agent-backend';
import type { AgentEvent, AgentSource } from '../agent-event';

const CODEX_COMMAND = 'codex';
/** `--full-auto` is Codex's equivalent of Claude Code's `--allowedTools` scoping (doc/v0-spec.md §4.4): auto-approve, sandboxed to the vault. */
const CODEX_FLAGS = ['--json', '--full-auto'];

/**
 * Pinned against a captured real stream from `codex exec --json` (Codex CLI 0.143.0), superseding
 * the earlier best-effort mapping written before Codex was installed on this machine (#51). Only
 * the fields this adapter reads are declared; everything else is ignored.
 */
interface CodexItem {
  id?: string;
  type?: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number;
  status?: string;
  changes?: unknown;
  server?: string;
  tool?: string;
  query?: string;
}

interface CodexStreamLine {
  type: string;
  thread_id?: string;
  item?: CodexItem;
  message?: string;
  error?: { message?: string };
}

const TOOL_ITEM_TYPES = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'web_search']);

function toolArgs(item: CodexItem): Record<string, unknown> {
  switch (item.type) {
    case 'command_execution':
      return { command: item.command };
    case 'file_change':
      return { changes: item.changes };
    case 'mcp_tool_call':
      return { server: item.server, tool: item.tool };
    case 'web_search':
      return { query: item.query };
    default:
      return {};
  }
}

/**
 * Codex adapter (doc/v0-spec.md §4.4): translates `codex exec --json`'s native stream into
 * `AgentEvent`s. The chat panel never sees `CodexStreamLine` — only what this module emits.
 *
 * Unlike Claude Code's single long-lived `-p --input-format stream-json` process, Codex's
 * headless mode runs one turn to completion and exits ("resumable sessions" per doc/v0-spec.md
 * §4.4): `start` only records `cwd`/`onEvent`, and each `send` spawns a fresh process — the
 * first turn via `codex exec`, later turns via `codex exec resume <thread_id>` — replacing the
 * previous turn's now-exited process the same way `agentProcessService.spawn` already does.
 */
export function createCodexBackend(): AgentBackend {
  let cwd = '';
  let model = '';
  let onEvent: ((event: AgentEvent) => void) | undefined;
  let threadId: string | undefined;
  const unlistenFns: UnlistenFn[] = [];
  let messageSeq = 0;

  function nextMessageId(): string {
    messageSeq += 1;
    return `codex-${messageSeq}`;
  }

  function translateItem(item: CodexItem, lineType: 'item.started' | 'item.completed', source: AgentSource, timestamp: number, emit: (event: AgentEvent) => void): void {
    if (item.type === 'reasoning') {
      // Surfaced as its own event so the UI can render it distinctly from `agent_message` (#49).
      if (lineType === 'item.completed' && item.text) {
        emit({ type: 'agent_reasoning', messageId: nextMessageId(), text: item.text, timestamp, source });
      }
      return;
    }

    if (item.type === 'agent_message') {
      if (lineType === 'item.completed' && item.text) {
        emit({ type: 'agent_message', messageId: nextMessageId(), text: item.text, timestamp, source });
      }
      return;
    }

    if (!item.type || !TOOL_ITEM_TYPES.has(item.type) || !item.id) return;

    if (lineType === 'item.started') {
      emit({ type: 'tool_call_start', callId: item.id, toolName: item.type, args: toolArgs(item), timestamp, source });
      return;
    }

    const isError = item.status === 'failed' || (item.type === 'command_execution' && item.exit_code !== undefined && item.exit_code !== 0);
    emit({
      type: 'tool_call_result',
      callId: item.id,
      toolName: item.type,
      status: isError ? 'error' : 'ok',
      result: isError ? undefined : (item.aggregated_output ?? item.changes),
      errorMessage: isError ? (item.aggregated_output ?? `${item.type} failed.`) : undefined,
      timestamp,
      source,
    });
  }

  function translate(line: CodexStreamLine, source: AgentSource, emit: (event: AgentEvent) => void): void {
    const timestamp = Date.now();
    switch (line.type) {
      case 'thread.started':
        if (line.thread_id) threadId = line.thread_id;
        break;
      case 'item.started':
        if (line.item) translateItem(line.item, 'item.started', source, timestamp, emit);
        break;
      case 'item.completed':
        if (line.item) translateItem(line.item, 'item.completed', source, timestamp, emit);
        break;
      case 'turn.completed':
        emit({ type: 'turn_done', timestamp, source });
        break;
      case 'turn.failed':
        emit({ type: 'error', message: line.error?.message ?? line.message ?? 'Codex turn failed.', timestamp, source });
        break;
      case 'error':
        emit({ type: 'error', message: line.message ?? 'Codex turn failed.', timestamp, source });
        break;
    }
  }

  return {
    id: 'codex',
    label: 'Codex',

    async start(startCwd, startModel, startOnEvent) {
      cwd = startCwd;
      model = startModel;
      onEvent = startOnEvent;
      threadId = undefined;
    },

    async send(prompt) {
      const emit = onEvent;
      if (!emit) return;

      for (const unlisten of unlistenFns.splice(0)) unlisten();

      let turnEnded = false;
      const unlistenStdout = await agentProcessService.onStdout((raw) => {
        let line: CodexStreamLine;
        try {
          line = JSON.parse(raw);
        } catch {
          return;
        }
        if (line.type === 'turn.completed' || line.type === 'turn.failed' || line.type === 'error') turnEnded = true;
        translate(line, 'codex', emit);
      });
      const unlistenExit = await agentProcessService.onExit(() => {
        // A turn ends when the process exits (resumable-session model) — only surface this as an
        // `error` when the process died before signaling `turn.completed`/`turn.failed` itself.
        if (!turnEnded) emit({ type: 'error', message: 'Codex process exited unexpectedly.', timestamp: Date.now(), source: 'codex' });
      });
      unlistenFns.push(unlistenStdout, unlistenExit);

      const args = threadId ? ['exec', 'resume', threadId, '--model', model, ...CODEX_FLAGS, prompt] : ['exec', '--model', model, ...CODEX_FLAGS, prompt];
      // `codex exec` treats a piped, still-open stdin as more input to append to the prompt and
      // blocks reading for it — close stdin immediately since the prompt is already a CLI arg.
      await agentProcessService.spawn(CODEX_COMMAND, args, cwd, false);
    },

    async stop() {
      for (const unlisten of unlistenFns.splice(0)) unlisten();
      await agentProcessService.stop();
    },
  };
}
