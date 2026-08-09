import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TauriListener = (event: { payload: unknown }) => void;
const listeners = new Map<string, TauriListener[]>();

const invokeMock = vi.fn();
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

function emitConfigChanged(paths: string[]) {
  for (const cb of listeners.get('config-changed') ?? []) cb({ payload: paths });
}

const { useConfigWatcher } = await import('./use-config-watcher');
const { useAppStore } = await import('@/stores/app-store');
const { useEditorStore } = await import('@/stores/editor-store');
const { useSettingsStore } = await import('@/stores/settings-store');
const { useToastStore } = await import('@/stores/toast-store');

const READ_SETTINGS_RESULT = {
  settings: { model: 'sonnet-5', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault' },
  diagnostics: [],
};

function ConfigWatcher() {
  useConfigWatcher();
  return null;
}

describe('useConfigWatcher', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(READ_SETTINGS_RESULT);
    listenMock.mockClear();
    listeners.clear();
    useAppStore.setState({ vaultRoot: '/vault' });
    useSettingsStore.setState({ settings: null, diagnostics: [], lastWrittenSnapshot: null });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('coalesces a burst of settings.toml events into a single reload', async () => {
    render(<ConfigWatcher />);
    await vi.waitFor(() => expect(listenMock).toHaveBeenCalled());

    emitConfigChanged(['/config/settings.toml']);
    emitConfigChanged(['/config/settings.toml']);
    emitConfigChanged(['/config/settings.toml']);

    await vi.advanceTimersByTimeAsync(150);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('read_settings');
  });

  it('ignores events for a different config file', async () => {
    render(<ConfigWatcher />);
    await vi.waitFor(() => expect(listenMock).toHaveBeenCalled());

    emitConfigChanged(['/config/keymaps.toml']);
    await vi.advanceTimersByTimeAsync(150);

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('warns and leaves a dirty config buffer untouched when its file changes on disk', async () => {
    useEditorStore.setState({
      buffers: [
        {
          id: 'buf-1',
          filePath: 'settings.toml',
          title: 'settings.toml',
          content: 'edited = true',
          dirty: true,
          revision: 2,
          savedRevision: 1,
          vimMode: 'normal',
          source: 'config',
        },
      ],
      activeBufferId: 'buf-1',
      saveRequests: [],
    });

    render(<ConfigWatcher />);
    await vi.waitFor(() => expect(listenMock).toHaveBeenCalled());

    emitConfigChanged(['/config/settings.toml']);

    expect(useEditorStore.getState().buffers[0]).toMatchObject({ content: 'edited = true', dirty: true });
    expect(useToastStore.getState().toasts).toContainEqual(expect.objectContaining({ message: 'settings.toml changed on disk — your unsaved edits were kept', tone: 'error' }));
  });

  it('does not warn when the changed config file has no dirty buffer open', async () => {
    useEditorStore.setState({
      buffers: [
        {
          id: 'buf-1',
          filePath: 'settings.toml',
          title: 'settings.toml',
          content: 'theme = "dark"',
          dirty: false,
          revision: 0,
          savedRevision: 0,
          vimMode: 'normal',
          source: 'config',
        },
      ],
      activeBufferId: 'buf-1',
      saveRequests: [],
    });

    render(<ConfigWatcher />);
    await vi.waitFor(() => expect(listenMock).toHaveBeenCalled());

    emitConfigChanged(['/config/settings.toml']);

    expect(useEditorStore.getState().buffers[0]).toMatchObject({ content: 'theme = "dark"', dirty: false });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
