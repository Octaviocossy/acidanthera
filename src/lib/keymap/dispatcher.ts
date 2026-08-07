import { useEffect } from 'react';
import { isEditableTarget } from '@/lib/dom/is-editable-target';
import { type Chord, type ChordKey, matchesChordStep } from './chord';

/** One command a {@link DispatcherLayer} can dispatch: its resolved chords (already
 *  conflict-resolved and trie-safe — see `resolve.ts`) and the effect it runs on a complete match. */
export interface DispatcherCommand {
  id: string;
  chords: Chord[];
  run: () => void;
}

/** One precedence level the dispatcher walks on every keydown. */
export interface DispatcherLayer {
  name: string;
  commands: DispatcherCommand[];
  /** Checked fresh on every keydown (spec decision 24) — a layer that goes inactive mid-sequence
   *  can't complete it; the sequence disarms instead of falling through to a lower layer. */
  isActive: () => boolean;
}

/** The subset of `KeyboardEvent` the dispatcher needs — narrow enough that `dispatcher.test.ts`
 *  can construct one without touching the DOM. */
export interface DispatcherKeyboardEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
  preventDefault(): void;
}

interface TrieNode {
  leaf: string | null;
  children: Array<{ step: ChordKey; node: TrieNode }>;
}

function newNode(): TrieNode {
  return { leaf: null, children: [] };
}

function sameStep(a: ChordKey, b: ChordKey): boolean {
  if (a.key !== b.key) return false;
  if (a.modifiers.size !== b.modifiers.size) return false;
  for (const modifier of a.modifiers) {
    if (!b.modifiers.has(modifier)) return false;
  }
  return true;
}

function insert(root: TrieNode, chord: Chord, commandId: string): void {
  let node = root;
  for (const step of chord) {
    let edge = node.children.find((candidate) => sameStep(candidate.step, step));
    if (!edge) {
      edge = { step, node: newNode() };
      node.children.push(edge);
    }
    node = edge.node;
  }
  node.leaf = commandId;
}

function buildTrie(commands: DispatcherCommand[]): TrieNode {
  const root = newNode();
  for (const command of commands) {
    for (const chord of command.chords) {
      if (chord.length === 0) continue;
      insert(root, chord, command.id);
    }
  }
  return root;
}

function step(node: TrieNode, event: DispatcherKeyboardEvent): TrieNode | null {
  const edge = node.children.find((candidate) => matchesChordStep(candidate.step, event));
  return edge ? edge.node : null;
}

export interface DispatcherOptions {
  /** Pending-sequence disarm timeout in ms — matches today's hand-rolled `Ctrl-w` prefix window. */
  timeoutMs?: number;
  setTimeout?: (fn: () => void, ms: number) => number;
  clearTimeout?: (id: number) => void;
}

const DEFAULT_TIMEOUT_MS = 1500;

export interface KeymapDispatcher {
  /** Handles one `keydown`. Returns whether the dispatcher claimed the event — it already called
   *  `preventDefault()` and, if a chord completed, already ran that command. */
  handleKeyDown(event: DispatcherKeyboardEvent): boolean;
  /** True while a sequence is armed and waiting for its next step (e.g. mid `Ctrl-w`). */
  isPending(): boolean;
  /** Clears any pending sequence and its timer. */
  dispose(): void;
}

/**
 * Builds a fresh dispatcher over `layers`, given highest-precedence first (spec decision 24:
 * `editor > active region > global` — the editor layer already wins by DOM event-propagation
 * order before this dispatcher runs at all, via `region-exit.ts`'s `Prec.highest` +
 * `stopPropagation`, so callers only order the remaining layers, e.g.
 * `[sidebarLayer, chatHistoryLayer, globalLayer]`). Builds one trie per layer from its resolved
 * chords. On each keydown, the first active layer whose trie has *any* match — a completed leaf
 * or a valid prefix — wins outright; lower-precedence layers are never consulted for that keydown
 * ("first match wins, no fallthrough"). A chord sequence, once armed in a layer, only continues
 * matching within that same layer — if the layer goes inactive or the next key doesn't continue
 * the sequence, it disarms rather than retrying as a fresh keydown in a different layer.
 */
export function createDispatcher(layers: DispatcherLayer[], options: DispatcherOptions = {}): KeymapDispatcher {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const setTimeoutFn = options.setTimeout ?? ((fn: () => void, ms: number) => window.setTimeout(fn, ms) as unknown as number);
  const clearTimeoutFn = options.clearTimeout ?? ((id: number) => window.clearTimeout(id));

  const tries = new Map(layers.map((layer) => [layer.name, buildTrie(layer.commands)]));
  const commandsByLayer = new Map(layers.map((layer) => [layer.name, new Map(layer.commands.map((command) => [command.id, command]))]));

  let pending: { layerName: string; node: TrieNode } | null = null;
  let timer: number | null = null;

  function clearPending(): void {
    pending = null;
    if (timer !== null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function armTimeout(): void {
    if (timer !== null) clearTimeoutFn(timer);
    timer = setTimeoutFn(clearPending, timeoutMs);
  }

  function runCommand(layerName: string, commandId: string): void {
    commandsByLayer.get(layerName)?.get(commandId)?.run();
  }

  function advance(layerName: string, node: TrieNode, event: DispatcherKeyboardEvent): boolean {
    if (node.leaf !== null) {
      event.preventDefault();
      runCommand(layerName, node.leaf);
      return true;
    }
    event.preventDefault();
    pending = { layerName, node };
    armTimeout();
    return true;
  }

  function handleKeyDown(event: DispatcherKeyboardEvent): boolean {
    if (isEditableTarget(event.target)) {
      clearPending();
      return false;
    }

    if (pending !== null) {
      const { layerName, node } = pending;
      const layer = layers.find((candidate) => candidate.name === layerName);
      clearPending();
      if (!layer || !layer.isActive()) return false;
      const next = step(node, event);
      if (next === null) return false;
      return advance(layerName, next, event);
    }

    for (const layer of layers) {
      if (!layer.isActive()) continue;
      const trie = tries.get(layer.name);
      if (!trie) continue;
      const next = step(trie, event);
      if (next === null) continue;
      return advance(layer.name, next, event);
    }

    return false;
  }

  return {
    handleKeyDown,
    isPending: () => pending !== null,
    dispose: clearPending,
  };
}

// --- Shared runtime: wires `useGlobalKeymap`, `useSidebarKeymap`, and `useChatHistoryKeymap`
// into ONE window-level dispatcher instead of three independent, racing `keydown` listeners
// (the bug this slice fixes — see the issue's Context). Each hook registers its own layer via
// `useDispatcherLayer`; this module owns the single `createDispatcher` instance and the single
// `window.addEventListener` call, rebuilding whenever a layer's bindings or guard change.

/** Region layers precede `global` (spec decision 24); `sidebar` and `chat.history` are mutually
 *  exclusive in practice (only one region is ever active), so their relative order doesn't matter. */
const LAYER_PRECEDENCE = ['sidebar', 'chat.history', 'global'] as const;

const registeredLayers = new Map<string, DispatcherLayer>();
let liveDispatcher: KeymapDispatcher | null = null;
let windowListenerAttached = false;

function rebuildDispatcher(): void {
  liveDispatcher?.dispose();
  const ordered = LAYER_PRECEDENCE.map((name) => registeredLayers.get(name)).filter((layer): layer is DispatcherLayer => layer !== undefined);
  liveDispatcher = createDispatcher(ordered);
}

function ensureWindowListenerAttached(): void {
  if (windowListenerAttached) return;
  windowListenerAttached = true;
  window.addEventListener('keydown', (event) => {
    liveDispatcher?.handleKeyDown(event);
  });
}

/** Registers `layer` in the shared window-level dispatcher for as long as the calling component
 *  is mounted, rebuilding the dispatcher whenever `layer`'s identity changes (i.e. whenever its
 *  bindings or guard closures are recomputed by the caller — see the three keymap hooks). */
export function useDispatcherLayer(layer: DispatcherLayer): void {
  useEffect(() => {
    registeredLayers.set(layer.name, layer);
    rebuildDispatcher();
    ensureWindowListenerAttached();
    return () => {
      registeredLayers.delete(layer.name);
      rebuildDispatcher();
    };
  }, [layer]);
}
