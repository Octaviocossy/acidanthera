import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '../agent-event';

type TauriListener = (event: { payload: unknown }) => void;
const listeners = new Map<string, TauriListener[]>();

const invokeMock = vi.fn().mockResolvedValue(undefined);
const listenMock = vi.fn((eventName: string, cb: TauriListener) => {
  const handlers = listeners.get(eventName) ?? [];
  handlers.push(cb);
  listeners.set(eventName, handlers);
  return Promise.resolve(() => {
    const idx = handlers.indexOf(cb);
    if (idx >= 0) handlers.splice(idx, 1);
  });
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: [string, TauriListener]) => listenMock(...args),
}));

function emitStdout(line: unknown): void {
  const raw = typeof line === 'string' ? line : JSON.stringify(line);
  for (const cb of listeners.get('agent-stdout') ?? []) cb({ payload: raw });
}

function emitExit(): void {
  for (const cb of listeners.get('agent-exit') ?? []) cb({ payload: undefined });
}

const { createClaudeCodeBackend } = await import('./claude-code.backend');

describe('createClaudeCodeBackend', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    listenMock.mockClear();
    listeners.clear();
  });

  async function startBackend() {
    const backend = createClaudeCodeBackend();
    const events: AgentEvent[] = [];
    await backend.start('/vault', 'claude-3-opus', (event) => events.push(event));
    return { backend, events };
  }

  it('spawns the claude CLI with the model flag on start', async () => {
    await startBackend();

    expect(invokeMock).toHaveBeenCalledWith('agent_spawn', {
      command: 'claude',
      args: ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--allowedTools', 'Read,Write,Edit,Glob,Grep', '--model', 'claude-3-opus'],
      cwd: '/vault',
      keepStdinOpen: true,
    });
  });

  it('translates a thinking block into agent_reasoning before the text block', async () => {
    const { events } = await startBackend();

    emitStdout({
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: 'let me think' },
          { type: 'text', text: 'the answer' },
        ],
      },
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'agent_reasoning', text: 'let me think', source: 'claude-code' });
    expect(events[1]).toMatchObject({ type: 'agent_message', text: 'the answer', source: 'claude-code' });
  });

  it('translates a tool_use block into tool_call_start', async () => {
    const { events } = await startBackend();

    emitStdout({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 'call-1', name: 'Read', input: { path: 'foo.md' } }] },
    });

    expect(events).toEqual([{ type: 'tool_call_start', callId: 'call-1', toolName: 'Read', args: { path: 'foo.md' }, timestamp: expect.any(Number), source: 'claude-code' }]);
  });

  it('pairs a tool_result with the prior tool_use by callId, carrying its name', async () => {
    const { events } = await startBackend();

    emitStdout({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'call-1', name: 'Read', input: {} }] } });
    emitStdout({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'call-1', content: 'file contents' }] } });

    expect(events[1]).toEqual({
      type: 'tool_call_result',
      callId: 'call-1',
      toolName: 'Read',
      status: 'ok',
      result: 'file contents',
      errorMessage: undefined,
      timestamp: expect.any(Number),
      source: 'claude-code',
    });
  });

  it('marks a tool_result with is_error as a failed tool call', async () => {
    const { events } = await startBackend();

    emitStdout({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'call-1', name: 'Write', input: {} }] } });
    emitStdout({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'call-1', is_error: true, content: 'permission denied' }] } });

    expect(events[1]).toMatchObject({ type: 'tool_call_result', callId: 'call-1', toolName: 'Write', status: 'error', result: undefined, errorMessage: 'permission denied' });
  });

  it('falls back to "unknown" tool name for an unmatched tool_result callId', async () => {
    const { events } = await startBackend();

    emitStdout({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'stray', content: 'ok' }] } });

    expect(events[0]).toMatchObject({ toolName: 'unknown' });
  });

  it('translates a successful result line into turn_done', async () => {
    const { events } = await startBackend();

    emitStdout({ type: 'result', subtype: 'success', is_error: false });

    expect(events).toEqual([{ type: 'turn_done', metadata: { subtype: 'success' }, timestamp: expect.any(Number), source: 'claude-code' }]);
  });

  it('translates a failed result line into an error event', async () => {
    const { events } = await startBackend();

    emitStdout({ type: 'result', subtype: 'error_max_turns', is_error: true, result: 'ran out of turns' });

    expect(events).toEqual([{ type: 'error', message: 'ran out of turns', timestamp: expect.any(Number), source: 'claude-code' }]);
  });

  it('ignores unparseable stdout lines', async () => {
    const { events } = await startBackend();

    emitStdout('not json');

    expect(events).toEqual([]);
  });

  it('emits an error when the process exits unexpectedly', async () => {
    const { events } = await startBackend();

    emitExit();

    expect(events).toEqual([{ type: 'error', message: 'Claude Code process exited unexpectedly.', timestamp: expect.any(Number), source: 'claude-code' }]);
  });

  it('sends a prompt as a stream-json user line', async () => {
    const { backend } = await startBackend();
    invokeMock.mockClear();

    await backend.send('hello there');

    expect(invokeMock).toHaveBeenCalledWith('agent_send', {
      input: JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'hello there' }] } }),
    });
  });

  it('unsubscribes listeners and stops the process on stop', async () => {
    const { backend, events } = await startBackend();

    await backend.stop();
    expect(invokeMock).toHaveBeenCalledWith('agent_stop');

    emitStdout({ type: 'result', subtype: 'success', is_error: false });
    emitExit();
    expect(events).toEqual([]);
  });
});
