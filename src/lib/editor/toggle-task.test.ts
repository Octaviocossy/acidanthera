import { describe, expect, it } from 'vitest';
import { toggleTaskAt } from './toggle-task';

/** Locates a marker the way the walker's parse does — by its range, not by a text search. */
function markerRange(content: string, marker: string): [number, number] {
  const from = content.indexOf(marker);
  if (from < 0) throw new Error(`expected ${marker} in the source`);
  return [from, from + marker.length];
}

describe('toggleTaskAt', () => {
  it('ticks an open task', () => {
    const content = '- [ ] buy milk';

    expect(toggleTaskAt(content, ...markerRange(content, '[ ]'))).toBe('- [x] buy milk');
  });

  it('unticks a completed task', () => {
    const content = '- [x] buy milk';

    expect(toggleTaskAt(content, ...markerRange(content, '[x]'))).toBe('- [ ] buy milk');
  });

  it('unticks an uppercase completed task, which has only one unchecked spelling to become', () => {
    const content = '- [X] buy milk';

    expect(toggleTaskAt(content, ...markerRange(content, '[X]'))).toBe('- [ ] buy milk');
  });

  it('leaves every byte outside the marker alone', () => {
    const content = '# Groceries\n\n- [ ] milk\n- [x] eggs\n\nTrailing prose with [brackets].\n';

    const next = toggleTaskAt(content, ...markerRange(content, '[ ]'));

    // Asserted as the whole document rather than as a length, so a rewrite that moved a byte
    // elsewhere in the note could not pass.
    expect(next).toBe('# Groceries\n\n- [x] milk\n- [x] eggs\n\nTrailing prose with [brackets].\n');
  });

  it('rewrites only the marker it was given when the note holds several', () => {
    const content = '- [ ] first\n- [ ] second';
    const second = content.lastIndexOf('[ ]');

    expect(toggleTaskAt(content, second, second + 3)).toBe('- [ ] first\n- [x] second');
  });

  it('returns the content unchanged when the offset points at something that is not a marker', () => {
    // A stale offset — a click racing an edit in the surface beside it — must be a no-op rather
    // than a corruption, which is the whole reason the slice is validated before it is replaced.
    const content = '- [ ] buy milk';

    expect(toggleTaskAt(content, 6, 9)).toBe(content);
  });

  it('returns the content unchanged for a range running past the end of the source', () => {
    const content = '- [ ] buy milk';

    expect(toggleTaskAt(content, content.length - 1, content.length + 4)).toBe(content);
  });

  it('returns the content unchanged for an empty or inverted range', () => {
    const content = '- [ ] buy milk';

    expect(toggleTaskAt(content, 2, 2)).toBe(content);
    expect(toggleTaskAt(content, 5, 2)).toBe(content);
  });
});
