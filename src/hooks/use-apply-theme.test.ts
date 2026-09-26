import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@/services/settings.service';
import { useSettingsStore } from '@/stores/settings-store';
import { useApplyTheme } from './use-apply-theme';

const BASE_SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault', dailyNoteFolder: 'daily', contentZoom: 1 };
const initialState = useSettingsStore.getState();

/** Installs a `document.startViewTransition` stub (jsdom has none). The update callbacks it receives
 *  are held, not run, so a test can observe the moment before and after the flip. */
function stubStartViewTransition() {
  const updates: Array<() => void> = [];
  const stub = vi.fn((update?: ViewTransitionUpdateCallback) => {
    if (update !== undefined) updates.push(() => void update());
    return { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition: () => {} } as unknown as ViewTransition;
  });
  Object.defineProperty(document, 'startViewTransition', { value: stub, configurable: true, writable: true });
  return { stub, updates };
}

function setTheme(theme: Settings['theme']) {
  act(() => {
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, theme }, diagnostics: [] });
  });
}

beforeEach(() => {
  useSettingsStore.setState(initialState, true);
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.removeProperty('--editor-font');
});

afterEach(() => {
  // Vitest runs without `globals`, so Testing Library's automatic cleanup never registers. A hook
  // left mounted from an earlier test would answer the next test's store change too, and call the
  // stub again. Same precedent as `src/components/layout/Sidebar.test.tsx:76`.
  cleanup();
  Reflect.deleteProperty(document, 'startViewTransition');
  vi.unstubAllGlobals();
});

describe('useApplyTheme', () => {
  it('leaves data-theme unset until settings load', () => {
    renderHook(() => useApplyTheme());

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('applies the boot-time theme instantly, without a view transition, even under StrictMode', () => {
    const { stub } = stubStartViewTransition();
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, theme: 'light' }, diagnostics: [] });

    renderHook(() => useApplyTheme(), { wrapper: StrictMode });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(stub).not.toHaveBeenCalled();
  });

  it('crossfades a later theme change, flipping inside the transition callback', () => {
    const { stub, updates } = stubStartViewTransition();
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });
    renderHook(() => useApplyTheme(), { wrapper: StrictMode });

    setTheme('light');

    expect(stub).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.theme).toBe('dark');

    updates[0]?.();

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('flips a later theme change instantly where startViewTransition is missing', () => {
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });
    renderHook(() => useApplyTheme());

    setTheme('light');

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('lands the newest theme when a second change arrives before the first crossfade flips', () => {
    const { stub, updates } = stubStartViewTransition();
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });
    renderHook(() => useApplyTheme());

    setTheme('light');
    setTheme('dark');

    expect(stub).toHaveBeenCalledTimes(2);

    updates[1]?.();
    updates[0]?.();

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('still crossfades with the OS reporting Reduce Motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))
    );
    const { stub } = stubStartViewTransition();
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });
    renderHook(() => useApplyTheme());

    setTheme('light');

    expect(stub).toHaveBeenCalledOnce();
  });

  it('writes --editor-font from the persisted setting', () => {
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });

    renderHook(() => useApplyTheme());

    expect(document.documentElement.style.getPropertyValue('--editor-font')).toBe('"JetBrains Mono", var(--font-mono)');
  });
});
