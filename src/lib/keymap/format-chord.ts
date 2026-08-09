import { type Chord, resolveModifiers } from './chord';

const KEY_LABELS: Record<string, string> = { Escape: 'esc', Enter: '⏎' };

function formatStep(step: Chord[number]): string {
  const modifiers = resolveModifiers(step.modifiers);
  const shiftedCharacter = modifiers.has('shift') && step.key.length === 1;
  const commandCharacter = modifiers.has('meta') && step.key.length === 1;
  const key = KEY_LABELS[step.key] ?? (shiftedCharacter || commandCharacter ? step.key.toUpperCase() : step.key.toLowerCase());
  const prefix = [modifiers.has('ctrl') && 'Ctrl+', modifiers.has('alt') && 'Alt+', modifiers.has('meta') && '⌘', modifiers.has('shift') && !shiftedCharacter && 'Shift+']
    .filter(Boolean)
    .join('');
  return `${prefix}${key}`;
}

/** Formats the first resolved chord as a compact, user-facing key hint. */
export function formatChord(chords: Chord[] | undefined): string | undefined {
  const first = chords?.[0];
  if (first === undefined) return undefined;

  return first.map(formatStep).join('');
}
