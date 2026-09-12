import { describe, expect, it } from 'vitest';
import { countWords, readingMinutes } from './note-stats';

describe('countWords', () => {
  it('counts no words in an empty note', () => {
    expect(countWords('')).toBe(0);
  });

  it('counts no words in a note holding only whitespace', () => {
    expect(countWords('  \n\t \n')).toBe(0);
  });

  it('counts a run of whitespace as one separator', () => {
    expect(countWords('one   two')).toBe(2);
  });

  it('counts across newlines as it does across spaces', () => {
    expect(countWords('one\ntwo\n\nthree')).toBe(3);
  });

  it('ignores leading and trailing whitespace', () => {
    expect(countWords('  one two  ')).toBe(2);
  });

  it('counts a markdown heading marker with the word it precedes, not as a word of its own', () => {
    expect(countWords('# Title')).toBe(2);
  });
});

describe('readingMinutes', () => {
  it('floors an empty note at one minute rather than reading zero', () => {
    expect(readingMinutes('')).toBe(1);
  });

  it('keeps exactly 200 words at one minute', () => {
    expect(readingMinutes(Array.from({ length: 200 }, () => 'word').join(' '))).toBe(1);
  });

  it('rounds 201 words up to two minutes', () => {
    expect(readingMinutes(Array.from({ length: 201 }, () => 'word').join(' '))).toBe(2);
  });
});
