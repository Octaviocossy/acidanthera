import { describe, expect, it } from 'vitest';
import { type Chord, canonicalChordString } from './chord';
import { resolveKeymap } from './resolve';

function chordStrings(chords: Chord[]): string[] {
  return chords.map((chord) => canonicalChordString(chord));
}

describe('resolveKeymap', () => {
  it('keeps every default binding when there is no override file', () => {
    const resolved = resolveKeymap(null);

    expect(chordStrings(resolved.layers.sidebar.get('sidebar.cursor-down') ?? [])).toEqual(['j']);
    expect(chordStrings(resolved.layers.global.get('global.find-file') ?? [])).toEqual(['ctrl-w f']);
    expect(resolved.diagnostics).toEqual([]);
  });

  it('replaces a command wholesale rather than merging with its default', () => {
    const resolved = resolveKeymap({ 'sidebar.cursor-down': ['ctrl-p'] });

    expect(chordStrings(resolved.layers.sidebar.get('sidebar.cursor-down') ?? [])).toEqual(['ctrl-p']);
    // The default "j" is gone entirely — not appended to.
    expect(resolved.layers.sidebar.get('sidebar.cursor-down')?.some((chord) => canonicalChordString(chord) === 'j')).toBe(false);
  });

  it('unbinds a command entirely when its override is an empty array', () => {
    const resolved = resolveKeymap({ 'global.find-file': [] });

    expect(resolved.layers.global.get('global.find-file')).toEqual([]);
  });

  it('resolves a chord conflict first-wins by command order and reports a diagnostic naming both commands', () => {
    // sidebar.cursor-up is declared before sidebar.new-note in APP_COMMANDS, so it should win "n".
    const resolved = resolveKeymap({
      'sidebar.cursor-up': ['n'],
      'sidebar.new-note': ['n'],
    });

    expect(chordStrings(resolved.layers.sidebar.get('sidebar.cursor-up') ?? [])).toEqual(['n']);
    expect(resolved.layers.sidebar.get('sidebar.new-note')).toEqual([]);
    expect(resolved.diagnostics.some((d) => d.message.includes('sidebar.cursor-up') && d.message.includes('sidebar.new-note') && d.message.includes('"n"'))).toBe(true);
  });

  it('drops an unknown command id with a diagnostic, leaving every other binding intact', () => {
    const resolved = resolveKeymap({
      'sidebar.totally-made-up': ['x'],
      'sidebar.cursor-down': ['ctrl-p'],
    });

    expect(resolved.diagnostics.some((d) => d.message.includes('sidebar.totally-made-up'))).toBe(true);
    expect(chordStrings(resolved.layers.sidebar.get('sidebar.cursor-down') ?? [])).toEqual(['ctrl-p']);
    expect(chordStrings(resolved.layers.sidebar.get('sidebar.cursor-up') ?? [])).toEqual(['k']);
  });

  it('drops a non-array override with a diagnostic and keeps the default', () => {
    const resolved = resolveKeymap({ 'sidebar.cursor-down': 'j' as unknown as string[] });

    expect(resolved.diagnostics.some((d) => d.message.includes('sidebar.cursor-down'))).toBe(true);
    expect(chordStrings(resolved.layers.sidebar.get('sidebar.cursor-down') ?? [])).toEqual(['j']);
  });

  it('drops an unparseable chord with a diagnostic, leaving the command with its other chords', () => {
    const resolved = resolveKeymap({ 'sidebar.open': ['l', 'not-a-modifier-x'] });

    expect(resolved.diagnostics.some((d) => d.message.includes('sidebar.open'))).toBe(true);
    expect(chordStrings(resolved.layers.sidebar.get('sidebar.open') ?? [])).toEqual(['l']);
  });

  it('rejects a merged layer where a chord is both a leaf and the prefix of another, reverting the whole layer to defaults', () => {
    // "ctrl-w" alone becomes a leaf, but "ctrl-w f" (global.find-file's default) still needs it as a prefix.
    const resolved = resolveKeymap({ 'global.toggle-chat': ['ctrl-w'] });

    const message = resolved.diagnostics.find((d) => d.message.includes('[global]'));
    expect(message).toBeDefined();
    expect(chordStrings(resolved.layers.global.get('global.toggle-chat') ?? [])).toEqual(['ctrl-w c']);
    expect(chordStrings(resolved.layers.global.get('global.find-file') ?? [])).toEqual(['ctrl-w f']);
  });

  it('falls back an unbound modal dismiss to its default with a diagnostic', () => {
    const resolved = resolveKeymap({ 'modal.cancel': [] });

    expect(chordStrings(resolved.layers.modal.get('modal.cancel') ?? [])).toEqual(['Escape']);
    expect(resolved.diagnostics.some((d) => d.message.includes('modal.cancel'))).toBe(true);
  });

  it('leaves a rebound (non-empty) modal dismiss untouched and silent', () => {
    const resolved = resolveKeymap({ 'modal.cancel': ['ctrl-g'] });

    expect(chordStrings(resolved.layers.modal.get('modal.cancel') ?? [])).toEqual(['ctrl-g']);
    expect(resolved.diagnostics).toEqual([]);
  });
});
