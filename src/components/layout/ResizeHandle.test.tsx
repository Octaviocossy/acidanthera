import { invoke } from '@tauri-apps/api/core';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sidebarRenderedWidth } from '@/lib/layout/panel-widths';
import type { Settings } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useToastStore } from '@/stores/toast-store';
import { ResizeHandle } from './ResizeHandle';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const BASE_SETTINGS: Settings = {
  model: 'sonnet-5',
  editorFont: 'JetBrains Mono',
  theme: 'dark',
  vaultPath: '/vault',
  dailyNoteFolder: 'daily',
  contentZoom: 1,
  sidebarWidth: 224,
  agentWidth: 340,
};

const initialAppState = useAppStore.getState();
const initialSettingsState = useSettingsStore.getState();
const initialToastState = useToastStore.getState();

function writeSettingsCalls() {
  return vi.mocked(invoke).mock.calls.filter(([command]) => command === 'write_settings');
}

beforeAll(() => {
  for (const method of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const) {
    Object.defineProperty(HTMLElement.prototype, method, { configurable: true, writable: true, value: vi.fn() });
  }
});

beforeEach(() => {
  useAppStore.setState(initialAppState, true);
  useSettingsStore.setState(initialSettingsState, true);
  useToastStore.setState(initialToastState, true);
  useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });
  sidebarRenderedWidth.set(224);
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockResolvedValue(undefined);
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1600 });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
});

describe('ResizeHandle', () => {
  describe('when it renders, and where it sits', () => {
    it('renders nothing for the agent panel while it is closed', () => {
      const { container } = render(<ResizeHandle panel="agent" />);
      expect(container.querySelector('[data-resize-handle="agent"]')).toBeNull();
    });

    it('renders nothing before the settings load', () => {
      useSettingsStore.setState({ settings: null, diagnostics: [] });
      const { container } = render(<ResizeHandle panel="sidebar" />);
      expect(container.querySelector('[data-resize-handle="sidebar"]')).toBeNull();
    });

    it('renders nothing while settings.toml has a syntax error', () => {
      useSettingsStore.setState({ diagnostics: [{ kind: 'syntax', message: 'bad toml', line: 1 }] });
      const { container } = render(<ResizeHandle panel="sidebar" />);
      expect(container.querySelector('[data-resize-handle="sidebar"]')).toBeNull();
    });

    it('is hidden from assistive tech and never focusable', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      expect(handle.getAttribute('aria-hidden')).toBe('true');
      expect(handle.hasAttribute('tabindex')).toBe(false);
    });

    it("sits centred on the sidebar's rendered edge", async () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      await waitFor(() => expect(handle.style.left).toBe('220px'));
    });

    it("sits centred on the agent panel's left edge", async () => {
      useAppStore.setState({ agentOpen: true });
      const { container } = render(<ResizeHandle panel="agent" />);
      const handle = container.querySelector('[data-resize-handle="agent"]') as HTMLElement;
      await waitFor(() => expect(handle.style.right).toBe('344px'));
    });
  });

  describe('pressing it', () => {
    it('keeps DOM focus where it was when pressed', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      expect(fireEvent.mouseDown(handle)).toBe(false);
    });

    it('captures the pointer on press', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      const spy = vi.spyOn(handle, 'setPointerCapture');
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 224 });
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('ignores a non-primary button', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 2, clientX: 224 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
      expect(useAppStore.getState().resizeDrag).toBeNull();
    });
  });

  describe('dragging the sidebar', () => {
    it('follows the pointer while the sidebar is dragged', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 576 });
      expect(useAppStore.getState().resizeDrag).toEqual({ panel: 'sidebar', width: 300 });
    });

    it('writes the released sidebar width once', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 576 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      const writes = writeSettingsCalls();
      expect(writes).toHaveLength(1);
      expect((writes[0]?.[1] as { settings: Settings }).settings.sidebarWidth).toBe(300);
      expect(useAppStore.getState().resizeDrag).toBeNull();
      expect(useSettingsStore.getState().settings?.sidebarWidth).toBe(300);
    });

    it('writes nothing when released at the width it started from', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 536 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      expect(writeSettingsCalls()).toHaveLength(0);
    });

    it('writes nothing for a press without movement', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      expect(writeSettingsCalls()).toHaveLength(0);
    });

    it('holds the sidebar at its minimum above the snap threshold', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 426 });

      expect(useAppStore.getState().resizeDrag).toEqual({ panel: 'sidebar', width: 180 });
      expect(useAppStore.getState().sidebarExpanded).toBe(true);
    });

    it('snaps the sidebar to the rail below 110px and writes nothing on release', () => {
      useAppStore.setState({ activeRegion: 'sidebar' });
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 376 });

      expect(useAppStore.getState().sidebarExpanded).toBe(false);
      expect(useAppStore.getState().activeRegion).toBe('viewer');
      expect(useAppStore.getState().resizeDrag).toBeNull();

      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(writeSettingsCalls()).toHaveLength(0);
    });

    it('expands the rail once dragged past 110px, following the pointer', () => {
      useAppStore.setState({ sidebarExpanded: false });
      sidebarRenderedWidth.set(40);
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 40 });

      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100 });
      expect(useAppStore.getState().sidebarExpanded).toBe(false);

      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120 });
      expect(useAppStore.getState().sidebarExpanded).toBe(true);
      expect(useAppStore.getState().resizeDrag).toEqual({ panel: 'sidebar', width: 180 });

      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250 });
      expect(useAppStore.getState().resizeDrag).toEqual({ panel: 'sidebar', width: 250 });

      fireEvent.pointerUp(handle, { pointerId: 1 });
      const writes = writeSettingsCalls();
      expect((writes[writes.length - 1]?.[1] as { settings: Settings }).settings.sidebarWidth).toBe(250);
    });
  });

  describe('dragging the agent panel', () => {
    it('stops the agent panel at its minimum instead of closing it', () => {
      useAppStore.setState({ agentOpen: true });
      const { container } = render(<ResizeHandle panel="agent" />);
      const handle = container.querySelector('[data-resize-handle="agent"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 700 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1000 });

      expect(useAppStore.getState().resizeDrag).toEqual({ panel: 'agent', width: 280 });
      expect(useAppStore.getState().agentOpen).toBe(true);
    });

    it('widens the agent panel when its edge is dragged left, and writes it on release', () => {
      useAppStore.setState({ agentOpen: true });
      const { container } = render(<ResizeHandle panel="agent" />);
      const handle = container.querySelector('[data-resize-handle="agent"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 700 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      const writes = writeSettingsCalls();
      expect(writes).toHaveLength(1);
      expect((writes[0]?.[1] as { settings: Settings }).settings.agentWidth).toBe(440);
    });

    it('writes the width it rendered when the window clamps the drag', () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
      useAppStore.setState({ agentOpen: true });
      const { container } = render(<ResizeHandle panel="agent" />);
      const handle = container.querySelector('[data-resize-handle="agent"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 700 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      const writes = writeSettingsCalls();
      expect((writes[0]?.[1] as { settings: Settings }).settings.agentWidth).toBe(384);
    });
  });

  describe('double click', () => {
    it('resets the sidebar to its default on double click', () => {
      useSettingsStore.setState({ settings: { ...BASE_SETTINGS, sidebarWidth: 300 } });
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.doubleClick(handle);

      const writes = writeSettingsCalls();
      expect((writes[0]?.[1] as { settings: Settings }).settings.sidebarWidth).toBe(224);
    });

    it('writes nothing on a double click at the default', () => {
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.doubleClick(handle);

      expect(writeSettingsCalls()).toHaveLength(0);
    });

    it('resets the agent panel to its default on double click', () => {
      useAppStore.setState({ agentOpen: true });
      useSettingsStore.setState({ settings: { ...BASE_SETTINGS, agentWidth: 500 } });
      const { container } = render(<ResizeHandle panel="agent" />);
      const handle = container.querySelector('[data-resize-handle="agent"]') as HTMLElement;
      fireEvent.doubleClick(handle);

      const writes = writeSettingsCalls();
      expect((writes[0]?.[1] as { settings: Settings }).settings.agentWidth).toBe(340);
    });

    it('ignores a double click on the rail', () => {
      useAppStore.setState({ sidebarExpanded: false });
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.doubleClick(handle);

      expect(writeSettingsCalls()).toHaveLength(0);
    });
  });

  describe('when things go wrong', () => {
    it('toasts when the width cannot be written', async () => {
      vi.mocked(invoke).mockReset();
      vi.mocked(invoke).mockRejectedValue(new Error('disk full'));
      const { container } = render(<ResizeHandle panel="sidebar" />);
      const handle = container.querySelector('[data-resize-handle="sidebar"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 500 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 576 });
      fireEvent.pointerUp(handle, { pointerId: 1 });

      await waitFor(() => expect(useToastStore.getState().toasts.some((toast) => toast.message.startsWith('Could not save the panel width'))).toBe(true));
    });

    it('ends a live drag when its panel closes', () => {
      useAppStore.setState({ agentOpen: true });
      const { container } = render(<ResizeHandle panel="agent" />);
      const handle = container.querySelector('[data-resize-handle="agent"]') as HTMLElement;
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 700 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600 });

      act(() => useAppStore.getState().closeAgent());

      expect(useAppStore.getState().resizeDrag).toBeNull();
    });
  });
});
