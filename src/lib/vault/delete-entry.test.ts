import { describe, expect, it } from 'vitest';
import type { EditorBuffer } from '@/stores/editor-store';
import { nextCursorAfterDelete, summarizeDeletion } from './delete-entry';
import type { FlatVaultRow } from './flatten-tree';

const tree = [
  {
    name: 'notes',
    path: '/vault/notes',
    isDir: true,
    children: [
      { name: 'first', path: '/vault/notes/first.md', isDir: false, children: null },
      { name: 'nested', path: '/vault/notes/nested', isDir: true, children: [{ name: 'second', path: '/vault/notes/nested/second.md', isDir: false, children: null }] },
    ],
  },
  { name: 'outside', path: '/vault/outside.md', isDir: false, children: null },
];

const buffers: EditorBuffer[] = [
  { id: 'first', filePath: '/vault/notes/first.md', title: 'first.md', content: '', dirty: true, revision: 1, savedRevision: 0, vimMode: 'normal', source: 'vault' },
  { id: 'second', filePath: '/vault/notes/nested/second.md', title: 'second.md', content: '', dirty: true, revision: 1, savedRevision: 0, vimMode: 'normal', source: 'vault' },
  { id: 'sibling', filePath: '/vault/notebook.md', title: 'notebook.md', content: '', dirty: true, revision: 1, savedRevision: 0, vimMode: 'normal', source: 'vault' },
  { id: 'config', filePath: '/vault/notes/settings.toml', title: 'settings.toml', content: '', dirty: true, revision: 1, savedRevision: 0, vimMode: 'normal', source: 'config' },
];

const rows: FlatVaultRow[] = [
  { entry: tree[0], depth: 0 },
  { entry: tree[0].children?.[0] ?? tree[0], depth: 1 },
  { entry: tree[0].children?.[1] ?? tree[0], depth: 1 },
  { entry: tree[0].children?.[1]?.children?.[0] ?? tree[0], depth: 2 },
  { entry: tree[1], depth: 0 },
];

describe('summarizeDeletion', () => {
  it('counts the cached subtree and names only dirty vault buffers beneath it', () => {
    expect(summarizeDeletion('/vault/notes', tree, buffers)).toEqual({
      counts: { files: 2, directories: 2 },
      dirtyBuffers: ['first.md', 'second.md'],
    });
  });

  it('does not match a prefix-named sibling buffer', () => {
    expect(summarizeDeletion('/vault/note', tree, buffers).dirtyBuffers).toEqual([]);
  });
});

describe('nextCursorAfterDelete', () => {
  it('uses the previous visible sibling when one exists', () => {
    expect(nextCursorAfterDelete(rows, '/vault/notes/nested')).toBe('/vault/notes/first.md');
  });

  it('falls back to the parent directory when deleting the first child', () => {
    expect(nextCursorAfterDelete(rows, '/vault/notes/first.md')).toBe('/vault/notes');
  });

  it('clears the cursor when deleting the only top-level entry', () => {
    expect(nextCursorAfterDelete([{ entry: tree[1], depth: 0 }], '/vault/outside.md')).toBeNull();
  });
});
