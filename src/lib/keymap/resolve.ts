import { APP_COMMANDS, type AppCommandId, type AppCommandLayer } from '@/lib/app-command';
import { type Chord, canonicalChordString, parseChord } from './chord';
import { commandIdsForLayer, DEFAULT_KEYMAP, KEYMAP_LAYERS, type KeymapLayer } from './defaults';

const COMMAND_LAYER = new Map<AppCommandId, AppCommandLayer>(APP_COMMANDS.map((command) => [command.id, command.layer]));
const KNOWN_COMMAND_IDS = new Set<string>(APP_COMMANDS.map((command) => command.id));

/** The command whose chord unbinds every modal's dismissal (spec decision 15: modal lockout guard). */
const MODAL_DISMISS_COMMAND: AppCommandId = 'modal.cancel';

/** One user-facing degradation note raised while resolving — a dropped id, a lost conflict, an
 *  unparseable chord, or a reverted layer. The file that produced it never fails outright (spec
 *  decision 10: per-cause degradation costs one binding, not the whole file). */
export interface KeymapDiagnostic {
  message: string;
}

/** A layer's resolved bindings: command id -> its surviving parsed chords, already conflict-free
 *  and safe to build a trie from (no chord is both a leaf and the prefix of another). */
export type LayerBindings = ReadonlyMap<AppCommandId, Chord[]>;

export interface ResolvedKeymap {
  layers: Record<KeymapLayer, LayerBindings>;
  diagnostics: KeymapDiagnostic[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function defaultChordSources(commandId: AppCommandId): string[] {
  return DEFAULT_KEYMAP[commandId] ?? [];
}

function parseChordList(commandId: AppCommandId, raw: readonly string[], diagnostics: KeymapDiagnostic[]): Chord[] {
  const parsed: Chord[] = [];
  for (const source of raw) {
    try {
      parsed.push(parseChord(source));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      diagnostics.push({ message: `"${commandId}": could not parse chord "${source}" (${reason}) — dropped.` });
    }
  }
  return parsed;
}

function isPrefixOf(shorter: Chord, longer: Chord): boolean {
  if (shorter.length >= longer.length) return false;
  return canonicalChordString(shorter) === canonicalChordString(longer.slice(0, shorter.length));
}

/** Finds a chord that is simultaneously a leaf and the prefix of another chord in `bindings` —
 *  a trie built from this set would be ambiguous (and, per the issue, `@codemirror/view` throws
 *  on exactly this shape rather than degrading). Returns the offending chord's canonical string,
 *  or `null` if the set is trie-safe. */
function findPrefixLeafConflict(bindings: LayerBindings): string | null {
  const all: Chord[] = [];
  for (const chords of bindings.values()) all.push(...chords);

  for (const a of all) {
    for (const b of all) {
      if (a === b) continue;
      if (isPrefixOf(a, b)) return canonicalChordString(a);
    }
  }
  return null;
}

/** Recomputes `layer`'s bindings straight from {@link DEFAULT_KEYMAP} — the safe fallback used
 *  when a merged layer turns out to be prefix/leaf-ambiguous. The defaults are authored
 *  conflict-free, so this never itself produces a conflict. */
function defaultLayerBindings(layer: KeymapLayer): Map<AppCommandId, Chord[]> {
  const bindings = new Map<AppCommandId, Chord[]>();
  for (const commandId of commandIdsForLayer(layer)) {
    bindings.set(
      commandId,
      defaultChordSources(commandId).map((source) => parseChord(source))
    );
  }
  return bindings;
}

/** Settles chord conflicts within one layer: first command (in {@link commandIdsForLayer} order)
 *  to claim a chord keeps it; every later claimant loses just that chord, with a diagnostic
 *  naming both commands (spec decision 22). Then validates the survivors are trie-safe, reverting
 *  the whole layer to its defaults on a prefix/leaf clash (spec decision 10 extended to layer
 *  granularity — narrower isn't safe, since the ambiguity is a property of the layer's whole set). */
function resolveLayer(layer: KeymapLayer, parsedByCommand: ReadonlyMap<AppCommandId, Chord[]>, diagnostics: KeymapDiagnostic[]): LayerBindings {
  const claimed = new Map<string, AppCommandId>();
  const bindings = new Map<AppCommandId, Chord[]>();

  for (const commandId of commandIdsForLayer(layer)) {
    const chords = parsedByCommand.get(commandId) ?? [];
    const surviving: Chord[] = [];
    for (const chord of chords) {
      const key = canonicalChordString(chord);
      const claimant = claimed.get(key);
      if (claimant !== undefined) {
        diagnostics.push({ message: `"${key}" is bound to both "${claimant}" and "${commandId}" in [${layer}] — "${commandId}" loses it.` });
        continue;
      }
      claimed.set(key, commandId);
      surviving.push(chord);
    }
    bindings.set(commandId, surviving);
  }

  const conflict = findPrefixLeafConflict(bindings);
  if (conflict !== null) {
    diagnostics.push({ message: `[${layer}]: "${conflict}" is used both as a full chord and as the prefix of another — reverting [${layer}] to its defaults.` });
    return defaultLayerBindings(layer);
  }

  return bindings;
}

/** Falls back "modal.cancel" to its default chord (with a diagnostic) if the merged config left
 *  it unbound — a rebound dismiss is fine, but a modal with none would be unescapable (spec
 *  decision 15). */
function applyModalLockoutGuard(layers: Record<KeymapLayer, LayerBindings>, diagnostics: KeymapDiagnostic[]): void {
  const dismissChords = layers.modal.get(MODAL_DISMISS_COMMAND) ?? [];
  if (dismissChords.length > 0) return;

  diagnostics.push({ message: `"${MODAL_DISMISS_COMMAND}" was left unbound — falling back to its default so every modal stays escapable.` });
  const fallback = new Map(layers.modal);
  fallback.set(
    MODAL_DISMISS_COMMAND,
    defaultChordSources(MODAL_DISMISS_COMMAND).map((source) => parseChord(source))
  );
  layers.modal = fallback;
}

/**
 * Resolves the merged keymap (epic #94, child #97). `overrides` is the raw parsed value of
 * `keymaps.toml` — a flat map from a full command id to a chord-string array, structurally
 * unvalidated (it comes straight off disk via `configService.parseConfigFile`). Per command, an
 * override **replaces** the default wholesale, never merges entry-by-entry (spec decision 20 /
 * ADR 0005) — `[]` unbinds it entirely. An unknown command id, a non-array value, or an
 * unparseable chord string degrades just that one binding with a diagnostic and keeps the rest of
 * the file (spec decision 10).
 */
export function resolveKeymap(overrides: Record<string, unknown> | null | undefined): ResolvedKeymap {
  const diagnostics: KeymapDiagnostic[] = [];
  const rawByCommand = new Map<AppCommandId, string[]>();

  for (const layer of KEYMAP_LAYERS) {
    for (const commandId of commandIdsForLayer(layer)) {
      rawByCommand.set(commandId, defaultChordSources(commandId));
    }
  }

  for (const [commandId, value] of Object.entries(overrides ?? {})) {
    if (!KNOWN_COMMAND_IDS.has(commandId)) {
      diagnostics.push({ message: `Unknown command id "${commandId}" in keymaps.toml — ignored.` });
      continue;
    }
    const layer = COMMAND_LAYER.get(commandId as AppCommandId);
    if (layer === undefined || layer === 'editor') {
      diagnostics.push({ message: `"${commandId}" isn't rebindable yet — ignored.` });
      continue;
    }
    if (!isStringArray(value)) {
      diagnostics.push({ message: `"${commandId}": expected an array of chord strings — ignored, kept its default.` });
      continue;
    }
    rawByCommand.set(commandId as AppCommandId, value);
  }

  const parsedByCommand = new Map<AppCommandId, Chord[]>();
  for (const [commandId, raw] of rawByCommand) {
    parsedByCommand.set(commandId, parseChordList(commandId, raw, diagnostics));
  }

  const layers = {} as Record<KeymapLayer, LayerBindings>;
  for (const layer of KEYMAP_LAYERS) {
    layers[layer] = resolveLayer(layer, parsedByCommand, diagnostics);
  }

  applyModalLockoutGuard(layers, diagnostics);

  return { layers, diagnostics };
}
