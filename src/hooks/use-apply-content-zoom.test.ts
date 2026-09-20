import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Settings } from '@/services/settings.service';
import { useSettingsStore } from '@/stores/settings-store';
import { clampContentZoom, useApplyContentZoom } from './use-apply-content-zoom';

const BASE_SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault', dailyNoteFolder: 'daily', contentZoom: 1 };
const initialState = useSettingsStore.getState();

beforeEach(() => {
  useSettingsStore.setState(initialState, true);
  document.documentElement.style.removeProperty('--content-scale');
});

describe('clampContentZoom', () => {
  it('passes a value already inside the bounds through unchanged', () => {
    expect(clampContentZoom(1.2)).toBe(1.2);
  });

  it('clamps a value below the minimum', () => {
    expect(clampContentZoom(0.1)).toBe(0.8);
  });

  it('clamps a value above the maximum', () => {
    expect(clampContentZoom(3)).toBe(1.6);
  });
});

describe('useApplyContentZoom', () => {
  it('leaves --content-scale unset until settings load', () => {
    renderHook(() => useApplyContentZoom());

    expect(document.documentElement.style.getPropertyValue('--content-scale')).toBe('');
  });

  it('writes --content-scale from the persisted setting', () => {
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, contentZoom: 1.2 }, diagnostics: [] });

    renderHook(() => useApplyContentZoom());

    expect(document.documentElement.style.getPropertyValue('--content-scale')).toBe('1.2');
  });

  it('clamps an out-of-range persisted value before writing it', () => {
    useSettingsStore.setState({ settings: { ...BASE_SETTINGS, contentZoom: 2.4 }, diagnostics: [] });

    renderHook(() => useApplyContentZoom());

    expect(document.documentElement.style.getPropertyValue('--content-scale')).toBe('1.6');
  });

  it('reacts to a later settings change', () => {
    useSettingsStore.setState({ settings: BASE_SETTINGS, diagnostics: [] });
    renderHook(() => useApplyContentZoom());
    expect(document.documentElement.style.getPropertyValue('--content-scale')).toBe('1');

    act(() => {
      useSettingsStore.setState({ settings: { ...BASE_SETTINGS, contentZoom: 1.4 } });
    });

    expect(document.documentElement.style.getPropertyValue('--content-scale')).toBe('1.4');
  });
});
