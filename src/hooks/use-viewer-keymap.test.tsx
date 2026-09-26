import { render, waitFor } from '@testing-library/react';
import { useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerViewerScrollContainer, unregisterViewerScrollContainer } from '@/lib/editor/viewer-scroll-container';
import { parseChord } from '@/lib/keymap/chord';
import { commandIdsForLayer } from '@/lib/keymap/defaults';
import * as dispatcherModule from '@/lib/keymap/dispatcher';
import { type DispatcherLayer, useDispatcherLayer } from '@/lib/keymap/dispatcher';
import { useAppStore } from '@/stores/app-store';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useViewerKeymap } from './use-viewer-keymap';

vi.mock('@/lib/keymap/dispatcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/keymap/dispatcher')>();
  return { ...actual, useDispatcherLayer: vi.fn(actual.useDispatcherLayer) };
});

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: vi.fn(() => false) };
});

function ViewerKeymap() {
  useViewerKeymap();
  return null;
}

function press(key: string, options: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options }));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Opens a vault buffer, which defaults to the read view (`openFile`'s own default). */
function openReadBuffer(filePath = '/vault/note.md'): EditorBuffer {
  useEditorStore.getState().openFile(filePath, '# Note');
  const buffer = useEditorStore.getState().buffers.find((candidate) => candidate.filePath === filePath);
  if (buffer === undefined) throw new Error('expected the buffer to be open');
  return buffer;
}

function registeredLayer(): DispatcherLayer | undefined {
  const calls = vi.mocked(dispatcherModule.useDispatcherLayer).mock.calls;
  return calls[calls.length - 1]?.[0];
}

function runCommand(id: string) {
  registeredLayer()
    ?.commands.find((command) => command.id === id)
    ?.run();
}

/** A fake `[global]` layer, registered through the real (mock-forwarded) `useDispatcherLayer`, so
 *  the non-swallow test can observe whether the shared dispatcher still reaches a lower layer. */
function GlobalStub({ run }: { run: () => void }) {
  const layer = useMemo<DispatcherLayer>(
    () => ({ name: 'global', commands: [{ id: 'global.toggle-sidebar', chords: [parseChord('ctrl-w b')], run }], isActive: () => true }),
    [run]
  );
  useDispatcherLayer(layer);
  return null;
}

function fakeScrollContainer(overrides: Partial<{ scrollTop: number; clientHeight: number; scrollHeight: number }> = {}): HTMLElement {
  const el = document.createElement('div');
  let scrollTop = overrides.scrollTop ?? 500;
  Object.defineProperty(el, 'clientHeight', { value: overrides.clientHeight ?? 200, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: overrides.scrollHeight ?? 2000, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
    configurable: true,
  });
  el.scrollTo = vi.fn((opts?: ScrollToOptions | number) => {
    if (typeof opts === 'object' && opts.top !== undefined) scrollTop = opts.top;
  }) as HTMLElement['scrollTo'];
  return el;
}

describe('useViewerKeymap', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer', mode: 'normal' });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  it('registers every viewer command declared in the catalog', () => {
    render(<ViewerKeymap />);

    const registeredIds = (registeredLayer()?.commands ?? []).map((command) => command.id).sort();
    expect(registeredIds).toEqual([...commandIdsForLayer('viewer')].sort());
  });

  describe('activation', () => {
    it('is active with the viewer focused, normal mode, and the active buffer in read view', () => {
      openReadBuffer();
      render(<ViewerKeymap />);

      expect(registeredLayer()?.isActive()).toBe(true);
    });

    it('is inactive with no buffer open (the home surface)', () => {
      render(<ViewerKeymap />);

      expect(registeredLayer()?.isActive()).toBe(false);
    });

    it('is inactive while the active buffer shows its edit view', () => {
      const buffer = openReadBuffer();
      useEditorStore.getState().setBufferView(buffer.id, 'edit');
      render(<ViewerKeymap />);

      expect(registeredLayer()?.isActive()).toBe(false);
    });

    it('is inactive while another region is focused', () => {
      openReadBuffer();
      useAppStore.setState({ activeRegion: 'sidebar' });
      render(<ViewerKeymap />);

      expect(registeredLayer()?.isActive()).toBe(false);
    });

    it('is inactive in command mode', () => {
      openReadBuffer();
      useAppStore.setState({ mode: 'command' });
      render(<ViewerKeymap />);

      expect(registeredLayer()?.isActive()).toBe(false);
    });

    it('does not set swallows — only the modal layer swallows', () => {
      render(<ViewerKeymap />);

      expect(registeredLayer()?.swallows).toBeUndefined();
    });
  });

  it('does not swallow an unclaimed chord — Ctrl-w b still reaches a lower layer', () => {
    openReadBuffer();
    const globalRun = vi.fn();
    render(
      <>
        <ViewerKeymap />
        <GlobalStub run={globalRun} />
      </>
    );

    press('w', { ctrlKey: true });
    press('b');

    expect(globalRun).toHaveBeenCalledTimes(1);
  });

  describe('scroll verbs', () => {
    it('scrolls down by about one line on scroll-down', () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.scroll-down');

      expect(container.scrollTop).toBeGreaterThan(500);
      unregisterViewerScrollContainer(container);
    });

    it('scrolls up by about one line on scroll-up', () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.scroll-up');

      expect(container.scrollTop).toBeLessThan(500);
      unregisterViewerScrollContainer(container);
    });

    it('scrolls down half the container height on half-page-down', async () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500, clientHeight: 200 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.half-page-down');

      await waitFor(() => expect(container.scrollTop).toBe(600));
      unregisterViewerScrollContainer(container);
    });

    it('scrolls up half the container height on half-page-up', async () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500, clientHeight: 200 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.half-page-up');

      await waitFor(() => expect(container.scrollTop).toBe(400));
      unregisterViewerScrollContainer(container);
    });

    it('reaches the top on goto-top', async () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.goto-top');

      await waitFor(() => expect(container.scrollTop).toBe(0));
      unregisterViewerScrollContainer(container);
    });

    it('reaches the bottom on goto-bottom, clamped to scrollHeight - clientHeight', async () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500, scrollHeight: 2000 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.goto-bottom');

      await waitFor(() => expect(container.scrollTop).toBe(1800));
      unregisterViewerScrollContainer(container);
    });

    it("measures a second quick half-page-down from the first one's target", async () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500, clientHeight: 200 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.half-page-down');
      runCommand('viewer.half-page-down');

      await waitFor(() => expect(container.scrollTop).toBe(700));
      unregisterViewerScrollContainer(container);
    });

    it("steps scroll-down instantly from an in-flight jump's target, and the jump never writes again", async () => {
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500, clientHeight: 200 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.half-page-down');
      runCommand('viewer.scroll-down');

      expect(container.scrollTop).toBe(624);

      await wait(50);
      expect(container.scrollTop).toBe(624);
      unregisterViewerScrollContainer(container);
    });

    it('jumps instantly under reduced motion', () => {
      vi.mocked(useReducedMotion).mockReturnValue(true);
      openReadBuffer();
      const container = fakeScrollContainer({ scrollTop: 500, clientHeight: 200 });
      registerViewerScrollContainer(container);
      render(<ViewerKeymap />);

      runCommand('viewer.half-page-down');

      expect(container.scrollTop).toBe(600);
      unregisterViewerScrollContainer(container);
    });

    it('is a no-op with no container registered', () => {
      openReadBuffer();
      render(<ViewerKeymap />);

      expect(() => runCommand('viewer.scroll-down')).not.toThrow();
    });
  });

  it('enqueues exactly one save request on viewer.save', () => {
    const buffer = openReadBuffer();
    render(<ViewerKeymap />);

    runCommand('viewer.save');

    const requests = useEditorStore.getState().saveRequests;
    expect(requests).toHaveLength(1);
    expect(requests[0]?.bufferId).toBe(buffer.id);
  });

  it('presses through the resolved chords end-to-end (g g reaches the top)', async () => {
    openReadBuffer();
    const container = fakeScrollContainer({ scrollTop: 500 });
    registerViewerScrollContainer(container);
    render(<ViewerKeymap />);

    press('g');
    press('g');

    await waitFor(() => expect(container.scrollTop).toBe(0));
    unregisterViewerScrollContainer(container);
  });
});
