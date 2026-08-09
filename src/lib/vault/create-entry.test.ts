import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlatVaultRow } from '@/lib/vault/flatten-tree';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { type EntryDraft, useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';
import { createVaultEntry, draftPlacement, resolveDraftParent, resolveParentForTarget } from './create-entry';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

function file(name: string, path: string): VaultEntry {
  return { name, path, isDir: false, children: null };
}

function dir(name: string, path: string, children: VaultEntry[] | null = []): VaultEntry {
  return { name, path, isDir: true, children };
}

function row(entry: VaultEntry, depth: number): FlatVaultRow {
  return { entry, depth };
}

describe('resolveDraftParent', () => {
  it('returns null when no vault is open', () => {
    expect(resolveDraftParent([], 'anything', null)).toBeNull();
  });

  it('falls back to the vault root when the cursor path matches no row', () => {
    const rows = [row(file('a.md', 'a.md'), 0)];
    expect(resolveDraftParent(rows, 'missing', '/vault')).toBe('/vault');
  });

  it('falls back to the vault root when there is no cursor at all (empty vault)', () => {
    expect(resolveDraftParent([], null, '/vault')).toBe('/vault');
  });

  it('targets a directory cursor row itself, so the entry becomes its child', () => {
    const rows = [row(dir('notes', '/vault/notes'), 0)];
    expect(resolveDraftParent(rows, '/vault/notes', '/vault')).toBe('/vault/notes');
  });

  it('targets a file cursor row parent, walking back to the nearest shallower row', () => {
    const rows = [row(dir('notes', '/vault/notes'), 0), row(file('a.md', '/vault/notes/a.md'), 1)];
    expect(resolveDraftParent(rows, '/vault/notes/a.md', '/vault')).toBe('/vault/notes');
  });

  it('falls back to the vault root when a top-level file cursor has no shallower row', () => {
    const rows = [row(file('a.md', '/vault/a.md'), 0)];
    expect(resolveDraftParent(rows, '/vault/a.md', '/vault')).toBe('/vault');
  });
});

describe('resolveParentForTarget', () => {
  it('returns null when no vault is open', () => {
    expect(resolveParentForTarget([], '/vault/notes', null)).toBeNull();
  });

  it('targets a directory row itself', () => {
    const rows = [row(dir('notes', '/vault/notes'), 0)];
    expect(resolveParentForTarget(rows, '/vault/notes', '/vault')).toBe('/vault/notes');
  });

  it('targets the parent directory of a file row', () => {
    const rows = [row(dir('notes', '/vault/notes'), 0), row(file('a.md', '/vault/notes/a.md'), 1)];
    expect(resolveParentForTarget(rows, '/vault/notes/a.md', '/vault')).toBe('/vault/notes');
  });

  it('uses the vault root for an empty-background target even when other rows exist', () => {
    const rows = [row(dir('notes', '/vault/notes'), 0), row(file('a.md', '/vault/notes/a.md'), 1)];
    expect(resolveParentForTarget(rows, null, '/vault')).toBe('/vault');
  });
});

describe('draftPlacement', () => {
  it("places the draft as its parent row's first child", () => {
    const rows = [row(dir('notes', '/vault/notes'), 0), row(file('a.md', '/vault/notes/a.md'), 1)];
    const draft: EntryDraft = { kind: 'note', parentPath: '/vault/notes' };
    expect(draftPlacement(rows, draft)).toEqual({ index: 1, depth: 1 });
  });

  it('places the draft at the top of the tree when the parent row is not found (rootless vault root)', () => {
    const draft: EntryDraft = { kind: 'note', parentPath: '/vault' };
    expect(draftPlacement([], draft)).toEqual({ index: 0, depth: 0 });
  });
});

describe('createVaultEntry', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    useSidebarStore.setState({ tree: [], expanded: new Set(), cursorPath: null, draft: { kind: 'note', parentPath: '/vault' } });
    useToastStore.setState({ toasts: [] });
    useEditorStore.setState({
      buffers: [],
      activeBufferId: null,
      saveRequests: [],
    });
    useAppStore.setState({ activeRegion: 'sidebar' });
  });

  it('cancels the draft without creating anything when the trimmed name is empty', async () => {
    await createVaultEntry({ kind: 'note', parentPath: '/vault' }, '   ');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(useSidebarStore.getState().draft).toBeNull();
  });

  it('rejects a name containing a path separator without creating anything', async () => {
    await createVaultEntry({ kind: 'note', parentPath: '/vault' }, 'a/b.md');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(useSidebarStore.getState().draft).not.toBeNull();
    const [toast] = useToastStore.getState().toasts;
    expect(toast).toMatchObject({ tone: 'error', message: 'Name cannot contain a path separator' });
  });

  it('creates a note, cancels the draft, moves the cursor, and opens the file', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'create_note') return '/vault/new.md';
      if (cmd === 'read_note') return '# hello';
      throw new Error(`unexpected command: ${cmd}`);
    });

    await createVaultEntry({ kind: 'note', parentPath: '/vault' }, 'new.md');

    expect(mockInvoke).toHaveBeenCalledWith('create_note', { path: '/vault/new.md' });
    expect(useSidebarStore.getState().draft).toBeNull();
    expect(useSidebarStore.getState().cursorPath).toBe('/vault/new.md');
    expect(useEditorStore.getState().buffers).toContainEqual(expect.objectContaining({ filePath: '/vault/new.md' }));
    expect(useAppStore.getState().activeRegion).toBe('viewer');
  });

  it('creates a directory, cancels the draft, and moves the cursor without opening a file', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'create_directory') return '/vault/newdir';
      throw new Error(`unexpected command: ${cmd}`);
    });

    await createVaultEntry({ kind: 'directory', parentPath: '/vault' }, 'newdir');

    expect(mockInvoke).toHaveBeenCalledWith('create_directory', { path: '/vault/newdir' });
    expect(useSidebarStore.getState().draft).toBeNull();
    expect(useSidebarStore.getState().cursorPath).toBe('/vault/newdir');
    expect(useEditorStore.getState().buffers).toEqual([]);
  });

  it('keeps the draft open and shows an error toast when creation fails (e.g. name collision)', async () => {
    mockInvoke.mockRejectedValue(new Error('AlreadyExists'));

    await createVaultEntry({ kind: 'note', parentPath: '/vault' }, 'dupe.md');

    expect(useSidebarStore.getState().draft).not.toBeNull();
    expect(useSidebarStore.getState().cursorPath).toBeNull();
    const [toast] = useToastStore.getState().toasts;
    expect(toast).toMatchObject({ tone: 'error', message: 'Create failed: AlreadyExists' });
  });

  it('shows an error toast when the note is created but fails to open', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'create_note') return '/vault/new.md';
      if (cmd === 'read_note') throw new Error('boom');
      throw new Error(`unexpected command: ${cmd}`);
    });

    await createVaultEntry({ kind: 'note', parentPath: '/vault' }, 'new.md');

    expect(useSidebarStore.getState().draft).toBeNull();
    const [toast] = useToastStore.getState().toasts;
    expect(toast).toMatchObject({ tone: 'error', message: 'Open failed: boom' });
  });
});
