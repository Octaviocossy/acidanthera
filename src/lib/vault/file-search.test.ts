import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { collectVaultFiles, rankVaultFiles } from './file-search';

function file(name: string, path: string): VaultEntry {
  return { name, path, isDir: false, children: null };
}

function dir(name: string, path: string, children: VaultEntry[]): VaultEntry {
  return { name, path, isDir: true, children };
}

describe('collectVaultFiles', () => {
  it('collects nested files independently of sidebar expansion state', () => {
    const tree = [dir('notes', '/vault/notes', [file('ideas.md', '/vault/notes/ideas.md')]), file('home.md', '/vault/home.md')];

    expect(collectVaultFiles(tree, '/vault')).toEqual([
      { path: '/vault/notes/ideas.md', relativePath: 'notes/ideas.md', name: 'ideas.md' },
      { path: '/vault/home.md', relativePath: 'home.md', name: 'home.md' },
    ]);
  });

  it('filters entries outside the active vault root', () => {
    expect(collectVaultFiles([file('other.md', '/other/other.md')], '/vault')).toEqual([]);
  });
});

describe('rankVaultFiles', () => {
  const candidates = [
    { path: '/vault/meeting-notes.md', relativePath: 'meeting-notes.md', name: 'meeting-notes.md' },
    { path: '/vault/archive/monday.md', relativePath: 'archive/monday.md', name: 'monday.md' },
    { path: '/vault/ideas.md', relativePath: 'ideas.md', name: 'ideas.md' },
  ];

  it('returns only subsequence matches ranked by contiguous characters', () => {
    expect(rankVaultFiles(candidates, 'mon').map((candidate) => candidate.relativePath)).toEqual(['archive/monday.md']);
  });

  it('sorts an empty query deterministically and respects the limit', () => {
    expect(rankVaultFiles(candidates, '', 2).map((candidate) => candidate.relativePath)).toEqual(['archive/monday.md', 'ideas.md']);
  });
});
