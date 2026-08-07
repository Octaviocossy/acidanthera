import { type CM5RangeInterface, type CodeMirrorV, type OperatorArgs, type Pos, Vim } from '@replit/codemirror-vim';
import { type Chord, type ChordKey, resolveModifiers } from '@/lib/keymap/chord';
import type { ResolvedKeymap } from '@/lib/keymap/resolve';
import { clipboardService } from '@/services/clipboard.service';
import { useToastStore } from '@/stores/toast-store';

function cursorMin(...positions: Pos[]): Pos {
  return positions.reduce((earliest, position) => (position.line < earliest.line || (position.line === earliest.line && position.ch < earliest.ch) ? position : earliest));
}

function systemYank(cm: CodeMirrorV, args: OperatorArgs, _ranges: CM5RangeInterface[], oldAnchor: Pos): Pos {
  const vim = cm.state.vim;
  const text = cm.getSelection();

  Vim.getRegisterController().pushText(args.registerName, 'yank', text, args.linewise, vim.visualBlock);

  if (!vim.visualMode || vim.visualLine) {
    void clipboardService.writeText(text).then(
      () => useToastStore.getState().showToast('Yanked to clipboard'),
      (err: unknown) => useToastStore.getState().showToast(`Yank failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    );
  }

  return vim.visualMode ? cursorMin(vim.sel.anchor, vim.sel.head) : oldAnchor;
}

let operatorDefined = false;
let appliedKeys: string[] = [];

/** Translates one chord step into Vim's own key notation (e.g. `<C-y>`) — only single, unmodified
 *  or Ctrl/Alt/Meta-modified single-character steps are supported; named multi-character keys
 *  (`Escape`, `ArrowDown`, …) have no equivalent here and are dropped. */
function stepToVimKey(step: ChordKey): string | null {
  if (step.key.length !== 1) return null;

  const modifiers = resolveModifiers(step.modifiers);
  const isAlpha = /[a-z]/i.test(step.key);
  const shiftsCase = modifiers.has('shift') && isAlpha;
  const key = shiftsCase ? step.key.toUpperCase() : step.key;

  const wrappers: string[] = [];
  if (modifiers.has('ctrl')) wrappers.push('C');
  if (modifiers.has('alt')) wrappers.push('A');
  if (modifiers.has('meta')) wrappers.push('M');
  if (modifiers.has('shift') && !shiftsCase) wrappers.push('S');

  return wrappers.length === 0 ? key : `<${wrappers.join('-')}-${key}>`;
}

/** A single-step chord translates to one Vim lhs; a sequence has no equivalent for a single-key
 *  operator mapping and is dropped. */
function chordToVimKey(chord: Chord): string | null {
  return chord.length === 1 ? stepToVimKey(chord[0]) : null;
}

/**
 * Idempotently applies `editor.system-yank` from `resolved` (epic #94, child #99): keeps the
 * clipboard-syncing `systemYank` Vim operator defined exactly once, then unmaps whatever key(s)
 * it was previously bound to and remaps it to the newly configured key(s) — unlike `:w` in
 * `save.ts`, `Vim.unmap` exists so this is fully reversible; rebinding away from the default `y`
 * restores vim's own built-in yank operator on that key. A charwise Visual yank still skips the
 * clipboard (see `systemYank` above, unchanged). Safe to call on every keymap change; a no-op
 * when the desired key(s) match what's already applied.
 */
export function apply(resolved: ResolvedKeymap): void {
  if (!operatorDefined) {
    Vim.defineOperator('systemYank', systemYank);
    operatorDefined = true;
  }

  const desired = resolved.editor['editor.system-yank'].map(chordToVimKey).filter((key): key is string => key !== null);

  if (desired.length === appliedKeys.length && desired.every((key, index) => key === appliedKeys[index])) return;

  // `unmap`'s TS signature requires a `ctx` string, but the mapping below is registered with no
  // context (matching vim's own context-agnostic `y` default) — the cast mirrors that omission.
  for (const key of appliedKeys) Vim.unmap(key, undefined as unknown as string);
  for (const key of desired) Vim.mapCommand(key, 'operator', 'systemYank', {}, {});
  appliedKeys = desired;
}
