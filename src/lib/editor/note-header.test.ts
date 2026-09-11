import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { countWikilinks, findNoteModified, noteBreadcrumb, noteTitle, stripLeadingH1 } from './note-header';

function note(path: string, modified: number | null = 1000): VaultEntry {
  return { name: path.split('/').pop() ?? path, path, isDir: false, modified, children: null };
}

function dir(path: string, children: VaultEntry[]): VaultEntry {
  return { name: path.split('/').pop() ?? path, path, isDir: true, modified: null, children };
}

describe('noteTitle', () => {
  it('drops the extension', () => {
    expect(noteTitle('/vault/engineering/Repository Pattern.md')).toBe('Repository Pattern');
  });

  it('leaves a basename with no extension alone', () => {
    expect(noteTitle('/vault/README')).toBe('README');
  });

  it('keeps a leading dot, which separates no extension', () => {
    expect(noteTitle('/vault/.gitignore')).toBe('.gitignore');
  });

  it('drops only the last extension', () => {
    expect(noteTitle('/vault/notes.2026.md')).toBe('notes.2026');
  });
});

describe('noteBreadcrumb', () => {
  it('joins the vault-relative directory to the full basename', () => {
    expect(noteBreadcrumb('/vault/engineering/Repository Pattern.md', '/vault')).toBe('engineering / Repository Pattern.md');
  });

  it('names every directory down to the note', () => {
    expect(noteBreadcrumb('/vault/a/b/c/Note.md', '/vault')).toBe('a / b / c / Note.md');
  });

  it('is the basename alone for a note at the vault root', () => {
    expect(noteBreadcrumb('/vault/Note.md', '/vault')).toBe('Note.md');
  });

  it('is the basename alone with no vault open', () => {
    expect(noteBreadcrumb('/elsewhere/deep/Note.md', null)).toBe('Note.md');
  });

  it('is the basename alone for a path outside the open vault', () => {
    expect(noteBreadcrumb('/elsewhere/deep/Note.md', '/vault')).toBe('Note.md');
  });

  it('tolerates a vault root written with a trailing slash', () => {
    expect(noteBreadcrumb('/vault/engineering/Note.md', '/vault/')).toBe('engineering / Note.md');
  });
});

describe('countWikilinks', () => {
  it('counts every wikilink in the source', () => {
    expect(countWikilinks('See [[One]] and [[Two]], plus [[Three]].')).toBe(3);
  });

  it('counts an aliased link once', () => {
    expect(countWikilinks('[[Repository Pattern|the pattern]]')).toBe(1);
  });

  it('is zero for a note with none', () => {
    expect(countWikilinks('# Heading\n\nProse with a [markdown link](https://example.com).')).toBe(0);
  });

  it('does not count a target holding brackets of its own', () => {
    // The shape `wikilink.ts` decorates forbids inner brackets, so this is not a link in either
    // view — the count and the decoration agree by sharing the same rule.
    expect(countWikilinks('[[a[b]c]]')).toBe(0);
  });

  it('counts the same link twice when it appears twice', () => {
    expect(countWikilinks('[[One]] and again [[One]]')).toBe(2);
  });
});

describe('stripLeadingH1', () => {
  it('removes a leading H1 so the title is not repeated', () => {
    expect(stripLeadingH1('# Repository Pattern\n\nProse.')).toBe('\nProse.');
  });

  it('removes it past leading blank lines', () => {
    expect(stripLeadingH1('\n\n# Title\nProse.')).toBe('\n\nProse.');
  });

  it('tolerates the three leading spaces CommonMark still calls a heading', () => {
    expect(stripLeadingH1('   # Title\nProse.')).toBe('Prose.');
  });

  it('leaves a note that opens with prose untouched', () => {
    const source = 'Prose first.\n\n# A heading further down.';
    expect(stripLeadingH1(source)).toBe(source);
  });

  it('leaves a note that opens with an H2 untouched', () => {
    const source = '## Subheading\n\nProse.';
    expect(stripLeadingH1(source)).toBe(source);
  });

  it('leaves a note that opens with a fence untouched, H1 inside it included', () => {
    const source = '```\n# not a heading\n```\n';
    expect(stripLeadingH1(source)).toBe(source);
  });

  it('leaves `#Title` untouched, which is not a heading', () => {
    const source = '#Title\n\nProse.';
    expect(stripLeadingH1(source)).toBe(source);
  });

  it('leaves an empty note untouched', () => {
    expect(stripLeadingH1('')).toBe('');
  });
});

describe('findNoteModified', () => {
  const tree = [note('/vault/Top.md', 111), dir('/vault/engineering', [note('/vault/engineering/Nested.md', 222), note('/vault/engineering/NoTime.md', null)])];

  it('finds a note at the root', () => {
    expect(findNoteModified(tree, '/vault/Top.md')).toBe(111);
  });

  it('finds a note nested in a directory', () => {
    expect(findNoteModified(tree, '/vault/engineering/Nested.md')).toBe(222);
  });

  it('is null for a note whose mtime could not be read', () => {
    expect(findNoteModified(tree, '/vault/engineering/NoTime.md')).toBeNull();
  });

  it('is null for a path the tree does not hold', () => {
    expect(findNoteModified(tree, '/vault/Missing.md')).toBeNull();
  });

  it('is null for an empty tree', () => {
    expect(findNoteModified([], '/vault/Top.md')).toBeNull();
  });
});
