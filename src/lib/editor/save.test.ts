import { EditorView } from '@codemirror/view';
import { getCM, Vim, vim } from '@replit/codemirror-vim';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useEditorStore } from '@/stores/editor-store';
import { apply } from './save';

function createEditor(extensions: ReturnType<typeof apply>[] = [apply(resolveKeymap(null))]) {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({ extensions: [vim(), ...extensions], parent });
  const cm = getCM(view);
  if (cm === null) throw new Error('Vim editor was not initialized');
  return { cm, view, parent };
}

describe('save', () => {
  let editor: ReturnType<typeof createEditor> | undefined;

  afterEach(() => {
    editor?.view.destroy();
    editor?.parent.remove();
    editor = undefined;
    vi.restoreAllMocks();
  });

  it('registers :w so it requests a save', () => {
    editor = createEditor();
    const requestSave = vi.spyOn(useEditorStore.getState(), 'requestSave');

    Vim.handleEx(editor.cm as Parameters<typeof Vim.handleEx>[0], 'w');

    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it('binds the default Mod-s chord to request a save', () => {
    editor = createEditor();
    const requestSave = vi.spyOn(useEditorStore.getState(), 'requestSave');

    editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 's' }));

    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it('rebinds editor.save to a configured chord and drops the old default', () => {
    const resolved = resolveKeymap({ 'editor.save': ['ctrl-alt-s'] });
    editor = createEditor([apply(resolved)]);
    const requestSave = vi.spyOn(useEditorStore.getState(), 'requestSave');

    editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 's' }));
    expect(requestSave).not.toHaveBeenCalled();

    editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, altKey: true, key: 's' }));
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: calling apply repeatedly keeps :w bound exactly once', () => {
    editor = createEditor();
    apply(resolveKeymap(null));
    apply(resolveKeymap(null));
    const requestSave = vi.spyOn(useEditorStore.getState(), 'requestSave');

    Vim.handleEx(editor.cm as Parameters<typeof Vim.handleEx>[0], 'w');

    expect(requestSave).toHaveBeenCalledTimes(1);
  });
});
