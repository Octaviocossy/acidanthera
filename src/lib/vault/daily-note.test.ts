import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useToastStore } from '@/stores/toast-store';
import { dailyNoteFileName, dailyNoteFolderPath, dailyNotePath, openDailyNote } from './daily-note';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

/** The exact text `VaultError::AlreadyExists` serializes to (`src-tauri/src/vault.rs`). */
const ALREADY_EXISTS = 'an entry already exists at that path';

const SETTINGS = { model: 'sonnet-5', editorFont: 'JetBrains Mono', theme: 'dark', vaultPath: '/vault', dailyNoteFolder: 'daily' } as const;

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
  useToastStore.setState({ toasts: [] });
  useAppStore.setState({ vaultRoot: '/vault', activeRegion: 'sidebar', editorFocusRequest: 0 });
  useSettingsStore.setState({ settings: { ...SETTINGS }, diagnostics: [] });
});

describe('dailyNoteFileName', () => {
  it('zero-pads a single-digit month and day', () => {
    expect(dailyNoteFileName(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05.md');
  });

  it('leaves two-digit parts alone', () => {
    expect(dailyNoteFileName(new Date(2026, 10, 23, 12, 0))).toBe('2026-11-23.md');
  });

  it('uses local date parts, not UTC', () => {
    // 23:30 local on the 9th is already the 10th in UTC anywhere west of Greenwich, and still the
    // 9th east of it — `toISOString()` would disagree with the calendar the user is looking at.
    const lateEvening = new Date(2026, 8, 9, 23, 30);

    expect(dailyNoteFileName(lateEvening)).toBe('2026-09-09.md');
  });

  it('rolls over at a year boundary', () => {
    expect(dailyNoteFileName(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31.md');
    expect(dailyNoteFileName(new Date(2027, 0, 1, 0, 1))).toBe('2027-01-01.md');
  });
});

describe('dailyNotePath', () => {
  it('joins with a POSIX separator', () => {
    expect(dailyNoteFolderPath('/vault', 'daily')).toBe('/vault/daily');
    expect(dailyNotePath('/vault', 'daily', new Date(2026, 8, 10))).toBe('/vault/daily/2026-09-10.md');
  });

  it('keeps a Windows separator when the vault root uses one', () => {
    expect(dailyNotePath('C:\\vault', 'journal', new Date(2026, 8, 10))).toBe('C:\\vault\\journal\\2026-09-10.md');
  });

  it('does not double a separator the vault root already ends with', () => {
    expect(dailyNoteFolderPath('/vault/', 'daily')).toBe('/vault/daily');
  });
});

describe('openDailyNote', () => {
  const today = new Date(2026, 8, 10);

  it('creates the folder and the note on first use, then opens it', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce('/vault/daily') // create_directory
      .mockResolvedValueOnce('/vault/daily/2026-09-10.md') // create_note
      .mockResolvedValueOnce(''); // read_note

    await openDailyNote(today);

    expect(invoke).toHaveBeenCalledWith('create_directory', { path: '/vault/daily' });
    expect(invoke).toHaveBeenCalledWith('create_note', { path: '/vault/daily/2026-09-10.md' });
    expect(useEditorStore.getState().buffers).toContainEqual(expect.objectContaining({ filePath: '/vault/daily/2026-09-10.md', content: '' }));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('opens the existing note when both the folder and the note are already there', async () => {
    vi.mocked(invoke)
      .mockRejectedValueOnce(ALREADY_EXISTS) // create_directory
      .mockRejectedValueOnce(ALREADY_EXISTS) // create_note
      .mockResolvedValueOnce('# yesterday I wrote this'); // read_note

    await openDailyNote(today);

    expect(invoke).toHaveBeenCalledWith('read_note', { path: '/vault/daily/2026-09-10.md' });
    expect(useEditorStore.getState().buffers).toContainEqual(expect.objectContaining({ content: '# yesterday I wrote this' }));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('creates only the note when the folder already exists', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(ALREADY_EXISTS).mockResolvedValueOnce('/vault/daily/2026-09-10.md').mockResolvedValueOnce('');

    await openDailyNote(today);

    expect(invoke).toHaveBeenCalledWith('create_note', { path: '/vault/daily/2026-09-10.md' });
    expect(useEditorStore.getState().activeBufferId).not.toBeNull();
  });

  it('files the note under the configured folder', async () => {
    useSettingsStore.setState({ settings: { ...SETTINGS, dailyNoteFolder: 'journal' } });
    vi.mocked(invoke).mockRejectedValueOnce(ALREADY_EXISTS).mockResolvedValueOnce('/vault/journal/2026-09-10.md').mockResolvedValueOnce('');

    await openDailyNote(today);

    expect(invoke).toHaveBeenCalledWith('create_directory', { path: '/vault/journal' });
    expect(invoke).toHaveBeenCalledWith('create_note', { path: '/vault/journal/2026-09-10.md' });
  });

  it('falls back to the default folder before settings have loaded', async () => {
    useSettingsStore.setState({ settings: null });
    vi.mocked(invoke).mockRejectedValueOnce(ALREADY_EXISTS).mockRejectedValueOnce(ALREADY_EXISTS).mockResolvedValueOnce('');

    await openDailyNote(today);

    expect(invoke).toHaveBeenCalledWith('create_directory', { path: '/vault/daily' });
  });

  it('reports a folder error that is not a collision, and never opens', async () => {
    vi.mocked(invoke).mockRejectedValueOnce('path escapes the vault root');

    await openDailyNote(today);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ tone: 'error' });
    expect(useEditorStore.getState().buffers).toHaveLength(0);
  });

  it('reports a note error that is not a collision, and never opens', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(ALREADY_EXISTS).mockRejectedValueOnce(new Error('Permission denied (os error 13)'));

    await openDailyNote(today);

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ tone: 'error' });
    expect(useEditorStore.getState().buffers).toHaveLength(0);
  });

  it('does nothing without an open vault', async () => {
    useAppStore.setState({ vaultRoot: null });

    await openDailyNote(today);

    expect(invoke).not.toHaveBeenCalled();
  });
});
