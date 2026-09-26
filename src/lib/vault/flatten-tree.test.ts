import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { flattenVisibleTree, treeVaultRoot } from './flatten-tree';

function file(name: string, path = name): VaultEntry {
  return { name, path, isDir: false, modified: null, children: null };
}

function dir(name: string, children: VaultEntry[] | null, path = name): VaultEntry {
  return { name, path, isDir: true, modified: null, children };
}

describe('flattenVisibleTree', () => {
  it('returns an empty array for an empty tree', () => {
    expect(flattenVisibleTree([], new Set())).toEqual([]);
  });

  it('flattens a flat list of files at depth 0', () => {
    const entries = [file('a.md'), file('b.md')];
    expect(flattenVisibleTree(entries, new Set())).toEqual([
      { entry: entries[0], depth: 0 },
      { entry: entries[1], depth: 0 },
    ]);
  });

  it('skips the children of a collapsed directory', () => {
    const child = file('child.md', 'dir/child.md');
    const entries = [dir('dir', [child])];
    expect(flattenVisibleTree(entries, new Set())).toEqual([{ entry: entries[0], depth: 0 }]);
  });

  it('descends into an expanded directory, incrementing depth', () => {
    const child = file('child.md', 'dir/child.md');
    const entries = [dir('dir', [child])];
    expect(flattenVisibleTree(entries, new Set(['dir']))).toEqual([
      { entry: entries[0], depth: 0 },
      { entry: child, depth: 1 },
    ]);
  });

  it('skips an expanded directory whose children is null', () => {
    const entries = [dir('dir', null)];
    expect(flattenVisibleTree(entries, new Set(['dir']))).toEqual([{ entry: entries[0], depth: 0 }]);
  });

  it('renders an expanded empty directory with no rows for its (empty) children', () => {
    const entries = [dir('dir', [])];
    expect(flattenVisibleTree(entries, new Set(['dir']))).toEqual([{ entry: entries[0], depth: 0 }]);
  });

  it('recurses through multiple nested expanded levels in document order', () => {
    const grandchild = file('gc.md', 'a/b/gc.md');
    const child = dir('b', [grandchild], 'a/b');
    const entries = [dir('a', [child])];
    expect(flattenVisibleTree(entries, new Set(['a', 'a/b']))).toEqual([
      { entry: entries[0], depth: 0 },
      { entry: child, depth: 1 },
      { entry: grandchild, depth: 2 },
    ]);
  });

  it('only expands directories whose path is in the expanded set, leaving siblings collapsed', () => {
    const childA = file('ca.md', 'a/ca.md');
    const childB = file('cb.md', 'b/cb.md');
    const entries = [dir('a', [childA]), dir('b', [childB])];
    expect(flattenVisibleTree(entries, new Set(['a']))).toEqual([
      { entry: entries[0], depth: 0 },
      { entry: childA, depth: 1 },
      { entry: entries[1], depth: 0 },
    ]);
  });
});

describe('treeVaultRoot', () => {
  it('returns null for an empty tree', () => {
    expect(treeVaultRoot([])).toBeNull();
  });

  it("returns the vault root for a tree whose first entry is '/vault/notes'", () => {
    expect(treeVaultRoot([file('notes', '/vault/notes')])).toBe('/vault');
  });

  it('splits on a backslash for a Windows path', () => {
    expect(treeVaultRoot([file('a.md', 'C:\\vault\\a.md')])).toBe('C:\\vault');
  });

  it('gives the same key for two trees read from one vault', () => {
    const first = treeVaultRoot([file('a.md', '/vault/a.md')]);
    const second = treeVaultRoot([file('b.md', '/vault/b.md'), file('a.md', '/vault/a.md')]);
    expect(first).toBe(second);
  });

  it('gives different keys for trees rooted at different depths', () => {
    expect(treeVaultRoot([file('a.md', '/a/a.md')])).not.toBe(treeVaultRoot([file('b.md', '/a/b/b.md')]));
  });
});
