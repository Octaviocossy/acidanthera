import { afterEach, describe, expect, it } from 'vitest';
import { parseChord } from './chord';
import { formatChord, formatChords } from './format-chord';

describe('formatChord', () => {
  afterEach(() => {
    delete (navigator as { platform?: string }).platform;
  });

  it('returns undefined when a command has no binding', () => {
    expect(formatChord(undefined)).toBeUndefined();
  });

  it('concatenates chord steps', () => {
    expect(formatChord([parseChord('d d')])).toBe('dd');
  });

  it('uppercases a shifted character', () => {
    expect(formatChord([parseChord('shift-x')])).toBe('X');
  });

  it('uses the named-key labels', () => {
    expect(formatChord([parseChord('escape')])).toBe('esc');
    expect(formatChord([parseChord('enter')])).toBe('⏎');
  });

  it('formats mod on macOS as Command', () => {
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });

    expect(formatChord([parseChord('mod-s')])).toBe('⌘S');
  });
});

describe('formatChords', () => {
  it('returns an empty list when a command has no binding', () => {
    expect(formatChords(undefined)).toEqual([]);
  });

  it('formats every bound chord in order, not just the first', () => {
    expect(formatChords([parseChord('l'), parseChord('enter')])).toEqual(['l', '⏎']);
  });
});
