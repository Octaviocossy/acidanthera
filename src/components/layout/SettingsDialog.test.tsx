import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsDialog } from './SettingsDialog';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const initialAppState = useAppStore.getState();
const initialSettingsState = useSettingsStore.getState();
const SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'Geist Mono', theme: 'dark', vaultPath: '/vault', dailyNoteFolder: 'daily', contentZoom: 1 };
const updateSettings = vi.fn().mockResolvedValue(undefined);

function renderOpen() {
  useAppStore.setState({ settingsOpen: true });
  return render(<SettingsDialog />);
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    useAppStore.setState(initialAppState, true);
    useSettingsStore.setState(initialSettingsState, true);
    useSettingsStore.setState({ settings: SETTINGS, diagnostics: [], updateSettings });
    updateSettings.mockClear();
  });
  afterEach(cleanup);

  it('focuses its panel on the first frame it opens', () => {
    renderOpen();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveFocus();
  });

  it('closes on Escape and takes no further keys once its exit phase begins', async () => {
    const closeSettings = vi.fn(() => useAppStore.setState({ settingsOpen: false }));
    useAppStore.setState({ closeSettings });
    renderOpen();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(closeSettings).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Settings' }).closest('[role="presentation"]')).toHaveAttribute('inert');
    expect(document.activeElement).toBe(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument());
  });

  it('never commits an uncommitted font draft when it closes', async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    await user.type(screen.getByRole('textbox', { name: 'Editor font' }), 'X');

    act(() => useAppStore.getState().closeSettings());

    expect(screen.getByRole('textbox', { name: 'Editor font' })).not.toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument());
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('still commits a font draft on blur while open', async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole('button', { name: 'Editor' }));
    const input = screen.getByRole('textbox', { name: 'Editor font' });
    await user.type(input, 'X');

    act(() => input.blur());

    expect(updateSettings).toHaveBeenCalledWith({ editorFont: 'Geist MonoX' });
  });

  it('reopens on the category it was left on', async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole('button', { name: 'Keymaps' }));
    act(() => useAppStore.getState().closeSettings());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument());

    act(() => useAppStore.getState().openSettings());

    expect(screen.getByRole('button', { name: 'Keymaps' })).toHaveAttribute('aria-current', 'page');
  });
});
