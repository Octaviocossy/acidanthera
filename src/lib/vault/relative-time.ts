const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Formats a note's last-modified time as the compact string a note row shows after `edited`:
 * `now`, `3m`, `1h`, `2d`, `5w`. The coarsest bucket that fits wins and every division floors, so
 * the string only ever understates the elapsed time.
 *
 * `now` is a parameter rather than a `Date.now()` call inside the function so tests can pin the
 * clock. Nothing in the app ticks it: the string is recomputed only when the tree re-renders
 * (watcher-driven), so a row may read `3m` slightly past the minute — accepted, because an
 * always-running interval for a cosmetic property is not worth its cost.
 */
export function relativeTime(modifiedMs: number, now: number = Date.now()): string {
  const elapsed = now - modifiedMs;

  // A timestamp in the future (clock skew, a file copied from another machine) lands here too,
  // which is the right answer: it was not edited any longer ago than "now".
  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;
  return `${Math.floor(elapsed / WEEK)}w`;
}
