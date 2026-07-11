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
  for (const cb of [...(listeners.get('agent-stdout') ?? [])]) cb({ payload: raw });
}

function emitExit(): void {
  for (const cb of [...(listeners.get('agent-exit') ?? [])]) cb({ payload: undefined });
}

const { createCodexBackend } = await import('./codex.backend');

describe('createCodexBackend', () => {
  beforeEach(() => {
    invokeMock.mockClear();
    listenMock.mockClear();
    listeners.clear();
  });

  async function startBackend() {
    const backend = createCodexBackend();
    const events: AgentEvent[] = [];
    await backend.start('/vault', 'gpt-5.4-mini', (event) => events.push(event));
    return { backend, events };
  }

  it('does not spawn a process on start (session begins on the first send)', async () => {
    await startBackend();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('spawns codex exec with the prompt on the first send, stdin closed', async () => {
    const { backend } = await startBackend();

    await backend.send('what is here?');

    expect(invokeMock).toHaveBeenCalledWith('agent_spawn', {
      command: 'codex',
      args: ['exec', '--json', '--skip-git-repo-check', '-c', 'sandbox_mode="workspace-write"', '--model', 'gpt-5.4-mini', 'what is here?'],
      cwd: '/vault',
      keepStdinOpen: false,
    });
  });

  it('resumes the thread on the second send once thread.started has been observed', async () => {
    const { backend } = await startBackend();

    await backend.send('first turn');
    emitStdout({ type: 'thread.started', thread_id: 'thread-123' });
    invokeMock.mockClear();

    await backend.send('second turn');

    expect(invokeMock).toHaveBeenCalledWith('agent_spawn', {
      command: 'codex',
      args: ['exec', 'resume', 'thread-123', '--json', '--skip-git-repo-check', '-c', 'sandbox_mode="workspace-write"', '--model', 'gpt-5.4-mini', 'second turn'],
      cwd: '/vault',
      keepStdinOpen: false,
    });
  });

  it('emits agent_reasoning only when a reasoning item completes', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'item.started', item: { id: 'r-1', type: 'reasoning' } });
    emitStdout({ type: 'item.completed', item: { id: 'r-1', type: 'reasoning', text: 'thinking it through' } });

    expect(events).toEqual([{ type: 'agent_reasoning', messageId: expect.any(String), text: 'thinking it through', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('emits agent_message only when an agent_message item completes', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'item.started', item: { id: 'm-1', type: 'agent_message' } });
    emitStdout({ type: 'item.completed', item: { id: 'm-1', type: 'agent_message', text: 'here is the answer' } });

    expect(events).toEqual([{ type: 'agent_message', messageId: expect.any(String), text: 'here is the answer', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('translates a command_execution item into a tool_call_start/tool_call_result pair', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'item.started', item: { id: 'c-1', type: 'command_execution', command: 'ls' } });
    emitStdout({ type: 'item.completed', item: { id: 'c-1', type: 'command_execution', command: 'ls', exit_code: 0, aggregated_output: 'a.md\nb.md' } });

    expect(events).toEqual([
      { type: 'tool_call_start', callId: 'c-1', toolName: 'command_execution', args: { command: 'ls' }, timestamp: expect.any(Number), source: 'codex' },
      {
        type: 'tool_call_result',
        callId: 'c-1',
        toolName: 'command_execution',
        status: 'ok',
        result: 'a.md\nb.md',
        errorMessage: undefined,
        timestamp: expect.any(Number),
        source: 'codex',
      },
    ]);
  });

  it('marks a command_execution with a non-zero exit code as a failed tool call', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'item.completed', item: { id: 'c-1', type: 'command_execution', command: 'false', exit_code: 1, aggregated_output: 'boom' } });

    expect(events[0]).toMatchObject({ type: 'tool_call_result', status: 'error', result: undefined, errorMessage: 'boom' });
  });

  it('marks an item with status "failed" as a failed tool call', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'item.completed', item: { id: 'f-1', type: 'mcp_tool_call', server: 'fs', tool: 'read', status: 'failed' } });

    expect(events[0]).toMatchObject({ type: 'tool_call_result', callId: 'f-1', toolName: 'mcp_tool_call', status: 'error' });
  });

  it('ignores an item.started for a non-tool item type', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'item.started', item: { id: 'm-1', type: 'agent_message' } });

    expect(events).toEqual([]);
  });

  it('translates turn.completed into turn_done', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'turn.completed' });

    expect(events).toEqual([{ type: 'turn_done', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('translates turn.failed into an error event using the nested error message', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'turn.failed', error: { message: 'sandbox denied write' } });

    expect(events).toEqual([{ type: 'error', message: 'sandbox denied write', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('translates a top-level error line into an error event', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'error', message: 'stream disconnected' });

    expect(events).toEqual([{ type: 'error', message: 'stream disconnected', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('does not surface an exit error once the turn has already ended', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout({ type: 'turn.completed' });
    emitExit();

    expect(events).toEqual([{ type: 'turn_done', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('surfaces an exit error when the process dies before the turn ends', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitExit();

    expect(events).toEqual([{ type: 'error', message: 'Codex process exited unexpectedly.', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('replaces the previous turn listeners on a new send, so stale stdout is ignored', async () => {
    const { backend, events } = await startBackend();
    await backend.send('first');
    await backend.send('second');

    emitStdout({ type: 'turn.completed' });

    expect(events).toEqual([{ type: 'turn_done', timestamp: expect.any(Number), source: 'codex' }]);
  });

  it('ignores unparseable stdout lines', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    emitStdout('not json');

    expect(events).toEqual([]);
  });

  it('does nothing on send before start has recorded an onEvent callback', async () => {
    const backend = createCodexBackend();
    await expect(backend.send('too early')).resolves.toBeUndefined();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('unsubscribes listeners and stops the process on stop', async () => {
    const { backend, events } = await startBackend();
    await backend.send('turn');

    await backend.stop();
    expect(invokeMock).toHaveBeenCalledWith('agent_stop');

    emitStdout({ type: 'turn.completed' });
    emitExit();
    expect(events).toEqual([]);
  });
});
