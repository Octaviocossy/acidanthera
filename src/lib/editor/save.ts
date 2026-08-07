import { type Extension, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { Vim } from '@replit/codemirror-vim';
import type { Chord, ChordKey } from '@/lib/keymap/chord';
import type { ResolvedKeymap } from '@/lib/keymap/resolve';
import { useEditorStore } from '@/stores/editor-store';

function requestSave(): boolean {
  useEditorStore.getState().requestSave();
  return true;
}

let exCommandRegistered = false;

function stepToCMKey(step: ChordKey): string {
  return [...step.modifiers, step.key].join('-');
}

function chordToCMKey(chord: Chord): string {
  return chord.map(stepToCMKey).join(' ');
}

/**
 * Idempotently applies `editor.save` from `resolved` (epic #94, child #99): keeps `:w` registered
 * on the shared Vim singleton exactly once — `Vim.defineEx` has no matching undefine, so `:w`
 * stays permanently bound regardless of `keymaps.toml` (spec decision 23) — and builds the
 * `Mod-s`-by-default CM keymap that mirrors it outside vim normal mode (doc/v0-spec.md §5.5
 * keyboard-first). Our chord notation (`ctrl-`/`mod-`/…, space-separated sequence steps) already
 * matches CodeMirror's own key-string syntax, which resolves modifiers case-insensitively — no
 * separate translation needed. Safe to call on every keymap change; only the returned `Extension`
 * changes run to run, meant to replace the previous one via `keymap-compartment.ts`'s
 * `Compartment`, never to accumulate.
 */
export function apply(resolved: ResolvedKeymap): Extension {
  if (!exCommandRegistered) {
    Vim.defineEx('write', 'w', requestSave);
    exCommandRegistered = true;
  }

  return Prec.highest(
    keymap.of(
      resolved.editor['editor.save'].map((chord) => ({
        key: chordToCMKey(chord),
        run: requestSave,
      }))
    )
  );
}
