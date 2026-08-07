import { describe, expect, it } from 'vitest';
import { canonicalChordString, matchesChordStep, parseChord, resolveModifiers } from './chord';

function keyEvent(overrides: Partial<Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>>) {
  return { key: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...overrides };
}

describe('parseChord', () => {
  it('parses a single step with one modifier', () => {
    const chord = parseChord('ctrl-w');

    expect(chord).toEqual([{ modifiers: new Set(['ctrl']), key: 'w' }]);
  });

  it('parses a sequence of steps separated by whitespace', () => {
    const chord = parseChord('ctrl-w f');

    expect(chord).toEqual([
      { modifiers: new Set(['ctrl']), key: 'w' },
      { modifiers: new Set(), key: 'f' },
    ]);
  });

  it('parses multiple modifiers on one step', () => {
    const chord = parseChord('ctrl-shift-p');

    expect(chord).toEqual([{ modifiers: new Set(['ctrl', 'shift']), key: 'p' }]);
  });

  it('lowercases modifier tokens regardless of case', () => {
    const chord = parseChord('Ctrl-W');

    expect(chord).toEqual([{ modifiers: new Set(['ctrl']), key: 'w' }]);
  });

  it('normalizes named keys to their KeyboardEvent.key form', () => {
    expect(parseChord('escape')).toEqual([{ modifiers: new Set(), key: 'Escape' }]);
    expect(parseChord('arrowdown')).toEqual([{ modifiers: new Set(), key: 'ArrowDown' }]);
    expect(parseChord('ctrl-arrowup')).toEqual([{ modifiers: new Set(['ctrl']), key: 'ArrowUp' }]);
  });

  it('throws on an unknown modifier', () => {
    expect(() => parseChord('foo-w')).toThrow();
  });
});

describe('resolveModifiers', () => {
  it('resolves mod to meta on mac', () => {
    const resolved = resolveModifiers(new Set(['mod']), 'mac');

    expect(resolved).toEqual(new Set(['meta']));
  });

  it('resolves mod to ctrl on other platforms', () => {
    const resolved = resolveModifiers(new Set(['mod']), 'other');

    expect(resolved).toEqual(new Set(['ctrl']));
  });

  it('leaves non-mod modifiers unchanged on either platform', () => {
    expect(resolveModifiers(new Set(['shift']), 'mac')).toEqual(new Set(['shift']));
    expect(resolveModifiers(new Set(['shift']), 'other')).toEqual(new Set(['shift']));
  });
});

describe('canonicalChordString', () => {
  it('resolves mod per platform', () => {
    const chord = parseChord('mod-s');

    expect(canonicalChordString(chord, 'mac')).toBe('meta-s');
    expect(canonicalChordString(chord, 'other')).toBe('ctrl-s');
  });

  it('orders modifiers consistently regardless of input order', () => {
    expect(canonicalChordString(parseChord('shift-ctrl-p'), 'other')).toBe(canonicalChordString(parseChord('ctrl-shift-p'), 'other'));
  });

  it('joins sequence steps with a space', () => {
    expect(canonicalChordString(parseChord('ctrl-w f'), 'other')).toBe('ctrl-w f');
  });
});

describe('matchesChordStep', () => {
  it('matches a plain letter key with no modifiers', () => {
    const [step] = parseChord('f');

    expect(matchesChordStep(step, keyEvent({ key: 'f' }))).toBe(true);
  });

  it('does not match when the base key differs', () => {
    const [step] = parseChord('f');

    expect(matchesChordStep(step, keyEvent({ key: 'g' }))).toBe(false);
  });

  it('does not match when an extra modifier is held', () => {
    const [step] = parseChord('f');

    expect(matchesChordStep(step, keyEvent({ key: 'f', shiftKey: true }))).toBe(false);
  });

  it('matches mod-s against ctrlKey on a non-mac platform', () => {
    const [step] = parseChord('mod-s');

    expect(matchesChordStep(step, keyEvent({ key: 's', ctrlKey: true }), 'other')).toBe(true);
    expect(matchesChordStep(step, keyEvent({ key: 's', metaKey: true }), 'other')).toBe(false);
  });

  it('matches mod-s against metaKey on mac', () => {
    const [step] = parseChord('mod-s');

    expect(matchesChordStep(step, keyEvent({ key: 's', metaKey: true }), 'mac')).toBe(true);
    expect(matchesChordStep(step, keyEvent({ key: 's', ctrlKey: true }), 'mac')).toBe(false);
  });

  it('matches the normalized Escape key, not the lowercase chord source', () => {
    const [step] = parseChord('escape');

    expect(matchesChordStep(step, keyEvent({ key: 'Escape' }))).toBe(true);
    // The case-sensitivity trap: a literal lowercase "escape" event.key must NOT match.
    expect(matchesChordStep(step, keyEvent({ key: 'escape' }))).toBe(false);
  });

  it('matches the normalized ArrowDown key, not the lowercase chord source', () => {
    const [step] = parseChord('arrowdown');

    expect(matchesChordStep(step, keyEvent({ key: 'ArrowDown' }))).toBe(true);
    expect(matchesChordStep(step, keyEvent({ key: 'arrowdown' }))).toBe(false);
  });
});
