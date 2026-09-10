import { describe, expect, it } from 'vitest';
import { relativeTime } from './relative-time';

/** A pinned clock, so every case reads as "this long before NOW" rather than depending on the wall clock. */
const NOW = 1_757_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe('relativeTime', () => {
  it('reads a just-saved note as "now"', () => {
    expect(relativeTime(NOW, NOW)).toBe('now');
  });

  it('stays "now" for the last second under a minute', () => {
    expect(relativeTime(NOW - (MINUTE - 1), NOW)).toBe('now');
  });

  it('switches to minutes exactly at one minute', () => {
    expect(relativeTime(NOW - MINUTE, NOW)).toBe('1m');
  });

  it('floors a partial minute', () => {
    expect(relativeTime(NOW - (3 * MINUTE + 59_000), NOW)).toBe('3m');
  });

  it('stays in minutes for the last second under an hour', () => {
    expect(relativeTime(NOW - (HOUR - 1), NOW)).toBe('59m');
  });

  it('switches to hours exactly at one hour', () => {
    expect(relativeTime(NOW - HOUR, NOW)).toBe('1h');
  });

  it('stays in hours for the last second under a day', () => {
    expect(relativeTime(NOW - (DAY - 1), NOW)).toBe('23h');
  });

  it('switches to days exactly at one day', () => {
    expect(relativeTime(NOW - DAY, NOW)).toBe('1d');
  });

  it('stays in days for the last second under a week', () => {
    expect(relativeTime(NOW - (WEEK - 1), NOW)).toBe('6d');
  });

  it('switches to weeks exactly at one week', () => {
    expect(relativeTime(NOW - WEEK, NOW)).toBe('1w');
  });

  it('keeps counting weeks for an old note', () => {
    expect(relativeTime(NOW - 30 * WEEK, NOW)).toBe('30w');
  });

  it('reads a future timestamp as "now" rather than a negative age', () => {
    expect(relativeTime(NOW + DAY, NOW)).toBe('now');
  });

  it('defaults the clock to the current time', () => {
    expect(relativeTime(Date.now())).toBe('now');
  });
});
