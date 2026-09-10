/**
 * The *navigation history*: a back/forward stack over **buffer activations**, keyed by buffer
 * file path (spec decision 35). Opening a note, clicking a tab and the *file finder* all push;
 * sidebar cursor movement, folder expansion, region focus changes and closing a buffer never do,
 * since none of them change what you are reading.
 *
 * Pure and separately testable — the store owns the buffers, this module owns the arithmetic.
 */
export interface NavigationHistory {
  entries: string[];
  /** Index of the current position in `entries`; `-1` only while `entries` is empty. */
  index: number;
}

/** Beyond this the oldest entries are dropped from the front — a session's worth of navigation,
 *  not a durable record; nothing persists this stack. */
export const NAVIGATION_HISTORY_LIMIT = 100;

export const EMPTY_NAVIGATION_HISTORY: NavigationHistory = { entries: [], index: -1 };

export type NavigationDirection = 'back' | 'forward';

export function canGoBack(history: NavigationHistory): boolean {
  return history.index > 0;
}

export function canGoForward(history: NavigationHistory): boolean {
  return history.index < history.entries.length - 1;
}

/**
 * Records an activation of `path`.
 *
 * Re-activating the buffer already at the cursor is not navigation, so it returns the history
 * unchanged. Anything else **truncates whatever sat after the cursor** — that is what makes
 * forward mean "the branch you just backed out of" rather than a second, unrelated stack.
 */
export function pushEntry(history: NavigationHistory, path: string): NavigationHistory {
  if (history.entries[history.index] === path) return history;

  const entries = [...history.entries.slice(0, history.index + 1), path];
  const overflow = Math.max(0, entries.length - NAVIGATION_HISTORY_LIMIT);
  const kept = overflow === 0 ? entries : entries.slice(overflow);
  return { entries: kept, index: kept.length - 1 };
}

/** Moves the cursor one entry back, or returns the history unchanged at the end of the stack. */
export function stepBack(history: NavigationHistory): NavigationHistory {
  return canGoBack(history) ? { ...history, index: history.index - 1 } : history;
}

/** Moves the cursor one entry forward, or returns the history unchanged at the end of the stack. */
export function stepForward(history: NavigationHistory): NavigationHistory {
  return canGoForward(history) ? { ...history, index: history.index + 1 } : history;
}

/**
 * Removes the entry at `at`, leaving `index` pointing at the same entry it pointed at before.
 *
 * Callers drop from the **pre-step** history, where the cursor is never the entry being removed —
 * which is what makes the one adjustment rule correct in both directions.
 */
export function dropEntryAt(history: NavigationHistory, at: number): NavigationHistory {
  if (at < 0 || at >= history.entries.length) return history;

  const entries = history.entries.filter((_, entryIndex) => entryIndex !== at);
  const index = history.index > at ? history.index - 1 : history.index;
  return { entries, index: Math.min(index, entries.length - 1) };
}

export interface NavigationStep {
  history: NavigationHistory;
  /** The path to activate, or `null` when the walk ran off the end without finding an open one. */
  path: string | null;
}

/**
 * Walks `direction` to the nearest entry whose buffer is still open.
 *
 * An entry naming a buffer closed since it was recorded is **skipped and dropped** rather than
 * reopened from disk — reopening would resurrect a note the user deliberately closed, and leaving
 * the entry in place would keep the control enabled for a click that does nothing. The pruning
 * survives even when nothing is found, which is what lets the control settle to disabled.
 */
export function navigateHistory(history: NavigationHistory, direction: NavigationDirection, isOpen: (path: string) => boolean): NavigationStep {
  let current = history;

  for (;;) {
    const next = direction === 'back' ? stepBack(current) : stepForward(current);
    if (next.index === current.index) return { history: current, path: null };

    const path = next.entries[next.index];
    if (isOpen(path)) return { history: next, path };

    // Each pass drops one entry, so the walk always terminates.
    current = dropEntryAt(current, next.index);
  }
}
