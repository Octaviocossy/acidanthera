import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { countNotes } from './note-count';

function note(name: string): VaultEntry {
  return { name, path: `/vault/${name}.md`, isDir: false, modified: 1_757_000_000_000, children: null };
}

function directory(name: string, children: VaultEntry[] | null): VaultEntry {
  return { name, path: `/vault/${name}`, isDir: true, modified: null, children };
}

describe('countNotes', () => {
  it('counts nothing in an empty vault', () => {
    expect(countNotes([])).toBe(0);
  });

  it('counts a flat list of notes', () => {
    expect(countNotes([note('first'), note('second')])).toBe(2);
  });

  it('counts notes nested inside directories', () => {
    expect(countNotes([note('top'), directory('folder', [note('inner'), note('other')])])).toBe(3);
  });

  it('counts notes at any depth', () => {
    expect(countNotes([directory('a', [directory('b', [directory('c', [note('deep')])])])])).toBe(1);
  });

  it('does not count the directories themselves', () => {
    expect(countNotes([directory('empty', []), directory('also-empty', [])])).toBe(0);
  });

  it('treats a directory with null children as empty', () => {
    expect(countNotes([directory('unread', null), note('sibling')])).toBe(1);
  });
});
