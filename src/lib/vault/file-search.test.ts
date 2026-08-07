import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { collectConfigCandidates, collectVaultFiles, rankVaultFiles } from './file-search';

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
      { path: '/vault/notes/ideas.md', relativePath: 'notes/ideas.md', name: 'ideas.md', source: 'vault' },
      { path: '/vault/home.md', relativePath: 'home.md', name: 'home.md', source: 'vault' },
    ]);
  });

  it('filters entries outside the active vault root', () => {
    expect(collectVaultFiles([file('other.md', '/other/other.md')], '/vault')).toEqual([]);
  });
});

describe('collectConfigCandidates', () => {
  it('unions the two config files with a synthetic config/-prefixed path, bypassing the vault-root filter', () => {
    expect(collectConfigCandidates()).toEqual([
      { path: 'settings.toml', relativePath: 'config/settings.toml', name: 'settings.toml', source: 'config' },
      { path: 'keymaps.toml', relativePath: 'config/keymaps.toml', name: 'keymaps.toml', source: 'config' },
    ]);
  });
});

describe('rankVaultFiles', () => {
  const candidates = [
    { path: '/vault/meeting-notes.md', relativePath: 'meeting-notes.md', name: 'meeting-notes.md', source: 'vault' as const },
    { path: '/vault/archive/monday.md', relativePath: 'archive/monday.md', name: 'monday.md', source: 'vault' as const },
    { path: '/vault/ideas.md', relativePath: 'ideas.md', name: 'ideas.md', source: 'vault' as const },
  ];

  it('returns only subsequence matches ranked by contiguous characters', () => {
    expect(rankVaultFiles(candidates, 'mon').map((candidate) => candidate.relativePath)).toEqual(['archive/monday.md']);
  });

  it('sorts an empty query deterministically and respects the limit', () => {
    expect(rankVaultFiles(candidates, '', 2).map((candidate) => candidate.relativePath)).toEqual(['archive/monday.md', 'ideas.md']);
  });
});
