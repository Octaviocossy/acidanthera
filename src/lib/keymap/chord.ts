/**
 * The single chord parser and normalizer (epic #94, child #95). One parser shared by the window
 * layer (`useGlobalKeymap`) and the CodeMirror layer (`regionExit`) is the only way both agree on
 * what a chord means, so this module must stay the sole place chord strings are interpreted.
 *
 * Chord strings use CodeMirror's hyphenated notation, e.g. `"ctrl-w f"` or `"mod-s"`: spaces
 * separate the steps of a sequence, hyphens separate a step's modifiers from its base key.
 * `mod-` is a virtual modifier resolved at match time to Cmd on macOS and Ctrl elsewhere.
 *
 * CodeMirror matches modifiers case-insensitively but compares the base key verbatim against
 * `KeyboardEvent.key` — `"escape"` and `"arrowdown"` would silently never match unless normalized
 * to `"Escape"`/`"ArrowDown"`. {@link parseChord} performs that normalization once, at parse time,
 * so every caller is safe from the trap.
 */

/** A modifier token as written in a chord string, including the virtual `mod` modifier. */
export type ChordModifierToken = 'ctrl' | 'alt' | 'shift' | 'meta' | 'mod';

/** A modifier as resolved against a concrete platform — `mod` has already been expanded. */
export type ChordModifier = 'ctrl' | 'alt' | 'shift' | 'meta';

/** One step of a chord sequence: a base key plus the modifiers held with it. */
export interface ChordKey {
  modifiers: Set<ChordModifierToken>;
  /** Normalized to match `KeyboardEvent.key` verbatim (e.g. `"Escape"`, `"f"`). */
  key: string;
}

/** A parsed chord: one step for a single keypress, multiple for a sequence like `"ctrl-w f"`. */
export type Chord = ChordKey[];

/** The platform a `mod-` modifier resolves against. */
export type ChordPlatform = 'mac' | 'other';

const NAMED_KEYS: Record<string, string> = {
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  space: ' ',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
};

const MODIFIER_TOKENS: ReadonlySet<ChordModifierToken> = new Set(['ctrl', 'alt', 'shift', 'meta', 'mod']);

function isChordModifierToken(value: string): value is ChordModifierToken {
  return MODIFIER_TOKENS.has(value as ChordModifierToken);
}

/** Normalizes a base-key token to the exact string `KeyboardEvent.key` produces: named keys
 *  (`escape`, `arrowdown`, …) to their PascalCase form, single characters to lowercase. */
function normalizeBaseKey(token: string): string {
  const lower = token.toLowerCase();
  const named = NAMED_KEYS[lower];
  if (named !== undefined) return named;
  return token.length === 1 ? lower : token;
}

function parseChordKey(step: string): ChordKey {
  const parts = step.split('-').filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error(`invalid chord step: "${step}"`);
  }
  const keyToken = parts[parts.length - 1];
  const modifiers = new Set<ChordModifierToken>();
  for (const token of parts.slice(0, -1)) {
    const modifier = token.toLowerCase();
    if (!isChordModifierToken(modifier)) {
      throw new Error(`unknown chord modifier: "${token}" in "${step}"`);
    }
    modifiers.add(modifier);
  }
  return { modifiers, key: normalizeBaseKey(keyToken) };
}

/** Parses a chord string into its sequence of steps. Throws on an unknown modifier or an empty step. */
export function parseChord(input: string): Chord {
  return input.trim().split(/\s+/).map(parseChordKey);
}

/** Resolves `detectPlatform`'s best guess from the runtime environment; falls back to `'other'`
 *  when no `navigator` is available (e.g. outside a browser/webview). */
export function detectPlatform(): ChordPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const platform = navigator.platform || navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/.test(platform) ? 'mac' : 'other';
}

/** Expands `mod` to `meta` on macOS or `ctrl` elsewhere, leaving every other modifier unchanged. */
export function resolveModifiers(modifiers: ReadonlySet<ChordModifierToken>, platform: ChordPlatform = detectPlatform()): Set<ChordModifier> {
  const resolved = new Set<ChordModifier>();
  for (const modifier of modifiers) {
    resolved.add(modifier === 'mod' ? (platform === 'mac' ? 'meta' : 'ctrl') : modifier);
  }
  return resolved;
}

const MODIFIER_ORDER: readonly ChordModifier[] = ['ctrl', 'alt', 'shift', 'meta'];

function canonicalStepString(step: ChordKey, platform: ChordPlatform): string {
  const resolved = resolveModifiers(step.modifiers, platform);
  const parts: string[] = MODIFIER_ORDER.filter((modifier) => resolved.has(modifier));
  parts.push(step.key);
  return parts.join('-');
}

/** Canonical string form of a chord, with `mod` resolved and modifiers in a fixed order — two
 *  chords bind the same gesture on `platform` iff their canonical strings are equal. Used for
 *  keymap conflict comparison. */
export function canonicalChordString(chord: Chord, platform: ChordPlatform = detectPlatform()): string {
  return chord.map((step) => canonicalStepString(step, platform)).join(' ');
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function eventModifiers(event: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): Set<ChordModifier> {
  const modifiers = new Set<ChordModifier>();
  if (event.ctrlKey) modifiers.add('ctrl');
  if (event.altKey) modifiers.add('alt');
  if (event.shiftKey) modifiers.add('shift');
  if (event.metaKey) modifiers.add('meta');
  return modifiers;
}

/** Whether `event` matches a single chord step: same normalized key, and exactly the same
 *  resolved modifier set (no more, no fewer). Callers manage sequence state themselves — this
 *  matches one step at a time, mirroring how `useGlobalKeymap`/`regionExit` track `Ctrl-w` prefixes. */
export function matchesChordStep(
  step: ChordKey,
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  platform: ChordPlatform = detectPlatform()
): boolean {
  if (event.key !== step.key) return false;
  return setsEqual(resolveModifiers(step.modifiers, platform), eventModifiers(event));
}
