import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useEditorStore } from '@/stores/editor-store';
import { editorKeymapExtension, reconfigureEditorKeymap, trackEditorView } from './keymap-compartment';

function createEditor(doc = 'alpha') {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({
    doc,
    extensions: [editorKeymapExtension(resolveKeymap(null)), trackEditorView()],
    parent,
  });
  return { view, parent };
}

describe('keymap-compartment', () => {
  let editor: ReturnType<typeof createEditor> | undefined;

  afterEach(() => {
    editor?.view.destroy();
    editor?.parent.remove();
    editor = undefined;
    vi.restoreAllMocks();
  });

  it('reconfigures the save keymap in a live view without rebuilding its EditorState', () => {
    editor = createEditor();
    const requestSave = vi.spyOn(useEditorStore.getState(), 'requestSave');

    // An edit and a cursor position that a full EditorState rebuild (vs. an in-place
    // reconfigure) would lose.
    editor.view.dispatch({ changes: { from: 5, insert: ' beta' }, selection: { anchor: 10 } });
    expect(editor.view.state.doc.toString()).toBe('alpha beta');

    reconfigureEditorKeymap(resolveKeymap({ 'editor.save': ['ctrl-alt-s'] }));

    // The edit and cursor position survived the reconfigure.
    expect(editor.view.state.doc.toString()).toBe('alpha beta');
    expect(editor.view.state.selection.main.head).toBe(10);

    // The old default no longer triggers a save...
    editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 's' }));
    expect(requestSave).not.toHaveBeenCalled();

    // ...but the newly configured chord does.
    editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, altKey: true, key: 's' }));
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it('reconfigures every live view, not just the one that triggered it', () => {
    const first = createEditor();
    const second = createEditor();
    const firstSave = vi.spyOn(useEditorStore.getState(), 'requestSave');

    reconfigureEditorKeymap(resolveKeymap({ 'editor.save': ['ctrl-alt-s'] }));

    first.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, altKey: true, key: 's' }));
    second.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, altKey: true, key: 's' }));

    expect(firstSave).toHaveBeenCalledTimes(2);

    first.view.destroy();
    first.parent.remove();
    second.view.destroy();
    second.parent.remove();
  });
});
