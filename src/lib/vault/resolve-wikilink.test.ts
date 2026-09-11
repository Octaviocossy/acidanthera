import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { parseWikilinkDisplay, parseWikilinkTarget, resolveWikilink } from './resolve-wikilink';

function note(path: string): VaultEntry {
  return { name: path.slice(path.lastIndexOf('/') + 1), path, isDir: false, modified: null, children: null };
}

function directory(path: string, children: VaultEntry[]): VaultEntry {
  return { name: path.slice(path.lastIndexOf('/') + 1), path, isDir: true, modified: null, children };
}

describe('parseWikilinkTarget', () => {
  it('reads a plain target, brackets or not', () => {
    expect(parseWikilinkTarget('[[Note]]')).toBe('Note');
    expect(parseWikilinkTarget('Note')).toBe('Note');
  });

  it('strips an alias', () => {
    expect(parseWikilinkTarget('[[Note|visible text]]')).toBe('Note');
  });

  it('strips a heading or block anchor', () => {
    expect(parseWikilinkTarget('[[Note#Section]]')).toBe('Note');
    expect(parseWikilinkTarget('[[Note^block-id]]')).toBe('Note');
  });

  it('strips an anchor that precedes an alias', () => {
    expect(parseWikilinkTarget('[[Note#Section|visible text]]')).toBe('Note');
  });

  it('leaves an anchor character inside an alias alone', () => {
    // The anchor is only sought *before* the alias, exactly as in `find_wikilinks`, so a `#` on the
    // far side of the `|` is part of the text the reader sees.
    expect(parseWikilinkTarget('[[Note|see #3]]')).toBe('Note');
  });

  it('trims the surrounding whitespace a rewrite preserves', () => {
    expect(parseWikilinkTarget('[[ Note |text]]')).toBe('Note');
  });
});

describe('parseWikilinkDisplay', () => {
  it('shows the alias when there is one', () => {
    expect(parseWikilinkDisplay('[[Note|visible text]]')).toBe('visible text');
  });

  it('shows the target when there is not — never the anchor, never the brackets', () => {
    expect(parseWikilinkDisplay('[[Note#Section]]')).toBe('Note');
  });
});

describe('resolveWikilink', () => {
  const tree = [note('/vault/Alpha.md'), directory('/vault/archive', [note('/vault/archive/Beta.md')])];

  it('resolves a target to the one note that carries the stem, at any depth', () => {
    expect(resolveWikilink('[[Beta]]', tree)).toEqual({ status: 'resolved', path: '/vault/archive/Beta.md' });
  });

  it('compares case-insensitively, because the macOS filesystem does', () => {
    expect(resolveWikilink('[[aLpHa]]', tree)).toEqual({ status: 'resolved', path: '/vault/Alpha.md' });
  });

  it('resolves an aliased and anchored target to the same note', () => {
    expect(resolveWikilink('[[Alpha#Intro|the first one]]', tree)).toEqual({ status: 'resolved', path: '/vault/Alpha.md' });
  });

  it('reports a target no note carries as missing', () => {
    expect(resolveWikilink('[[Gamma]]', tree)).toEqual({ status: 'missing' });
  });

  it('reports an empty target as missing rather than matching every note', () => {
    expect(resolveWikilink('[[|just an alias]]', tree)).toEqual({ status: 'missing' });
  });

  it('marks a stem two notes share as ambiguous rather than guessing one', () => {
    const shared = [note('/vault/Alpha.md'), directory('/vault/archive', [note('/vault/archive/Alpha.md')])];

    expect(resolveWikilink('[[Alpha]]', shared)).toEqual({ status: 'ambiguous' });
  });

  it('ignores a directory whose name matches the target', () => {
    const withFolder = [directory('/vault/Alpha', []), note('/vault/notes/Alpha.md')];

    expect(resolveWikilink('[[Alpha]]', withFolder)).toEqual({ status: 'resolved', path: '/vault/notes/Alpha.md' });
  });
});
