import { describe, expect, it } from 'vitest';
import { canGoBack, canGoForward, EMPTY_NAVIGATION_HISTORY, NAVIGATION_HISTORY_LIMIT, navigateHistory, pushEntry, stepBack, stepForward } from './navigation-history';

/** Builds a history whose cursor sits on `index`, or on the last entry by default. */
function historyOf(entries: string[], index = entries.length - 1) {
  return { entries, index };
}

const alwaysOpen = () => true;

describe('pushEntry', () => {
  it('records the first activation', () => {
    expect(pushEntry(EMPTY_NAVIGATION_HISTORY, 'a.md')).toEqual({ entries: ['a.md'], index: 0 });
  });

  it('returns the history unchanged when the current entry is re-activated', () => {
    const history = historyOf(['a.md', 'b.md']);

    expect(pushEntry(history, 'b.md')).toBe(history);
  });

  it('records a path that is in the stack but is not the current entry', () => {
    expect(pushEntry(historyOf(['a.md', 'b.md']), 'a.md')).toEqual({ entries: ['a.md', 'b.md', 'a.md'], index: 2 });
  });

  it('truncates the forward branch it was backed out of', () => {
    const backedOut = historyOf(['a.md', 'b.md', 'c.md'], 0);

    expect(pushEntry(backedOut, 'd.md')).toEqual({ entries: ['a.md', 'd.md'], index: 1 });
  });

  it('drops the oldest entries once the cap is reached', () => {
    const full = Array.from({ length: NAVIGATION_HISTORY_LIMIT }, (_, index) => `note-${index}.md`);

    const pushed = pushEntry(historyOf(full), 'newest.md');

    expect(pushed.entries).toHaveLength(NAVIGATION_HISTORY_LIMIT);
    expect(pushed.entries[0]).toBe('note-1.md');
    expect(pushed.entries[pushed.entries.length - 1]).toBe('newest.md');
    expect(pushed.index).toBe(NAVIGATION_HISTORY_LIMIT - 1);
  });
});

describe('canGoBack', () => {
  it('is false on an empty history and on the first entry', () => {
    expect(canGoBack(EMPTY_NAVIGATION_HISTORY)).toBe(false);
    expect(canGoBack(historyOf(['a.md']))).toBe(false);
  });

  it('is true once a second entry has been recorded', () => {
    expect(canGoBack(historyOf(['a.md', 'b.md']))).toBe(true);
  });
});

describe('canGoForward', () => {
  it('is false on an empty history and at the newest entry', () => {
    expect(canGoForward(EMPTY_NAVIGATION_HISTORY)).toBe(false);
    expect(canGoForward(historyOf(['a.md', 'b.md']))).toBe(false);
  });

  it('is true once the cursor has moved back', () => {
    expect(canGoForward(historyOf(['a.md', 'b.md'], 0))).toBe(true);
  });
});

describe('stepBack', () => {
  it('moves the cursor one entry back', () => {
    expect(stepBack(historyOf(['a.md', 'b.md']))).toEqual({ entries: ['a.md', 'b.md'], index: 0 });
  });

  it('returns the history unchanged at the oldest entry', () => {
    const history = historyOf(['a.md']);

    expect(stepBack(history)).toBe(history);
  });
});

describe('stepForward', () => {
  it('moves the cursor one entry forward', () => {
    expect(stepForward(historyOf(['a.md', 'b.md'], 0))).toEqual({ entries: ['a.md', 'b.md'], index: 1 });
  });

  it('returns the history unchanged at the newest entry', () => {
    const history = historyOf(['a.md', 'b.md']);

    expect(stepForward(history)).toBe(history);
  });
});

describe('navigateHistory', () => {
  it('walks back to the previous entry', () => {
    expect(navigateHistory(historyOf(['a.md', 'b.md']), 'back', alwaysOpen)).toEqual({
      history: { entries: ['a.md', 'b.md'], index: 0 },
      path: 'a.md',
    });
  });

  it('walks forward to the next entry', () => {
    expect(navigateHistory(historyOf(['a.md', 'b.md'], 0), 'forward', alwaysOpen)).toEqual({
      history: { entries: ['a.md', 'b.md'], index: 1 },
      path: 'b.md',
    });
  });

  it('reports no path at the end of the stack', () => {
    expect(navigateHistory(historyOf(['a.md']), 'back', alwaysOpen)).toEqual({ history: { entries: ['a.md'], index: 0 }, path: null });
  });

  it('skips a closed entry walking back and drops it from the stack', () => {
    const open = (path: string) => path !== 'b.md';

    expect(navigateHistory(historyOf(['a.md', 'b.md', 'c.md']), 'back', open)).toEqual({
      history: { entries: ['a.md', 'c.md'], index: 0 },
      path: 'a.md',
    });
  });

  it('skips a closed entry walking forward and drops it from the stack', () => {
    const open = (path: string) => path !== 'b.md';

    expect(navigateHistory(historyOf(['a.md', 'b.md', 'c.md'], 0), 'forward', open)).toEqual({
      history: { entries: ['a.md', 'c.md'], index: 1 },
      path: 'c.md',
    });
  });

  it('keeps the pruning when every entry in that direction was closed', () => {
    const open = (path: string) => path === 'c.md';

    expect(navigateHistory(historyOf(['a.md', 'b.md', 'c.md']), 'back', open)).toEqual({ history: { entries: ['c.md'], index: 0 }, path: null });
  });
});
