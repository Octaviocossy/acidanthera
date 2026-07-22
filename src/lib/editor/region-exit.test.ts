import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { regionExit } from './region-exit';

const initialFileFinderState = useFileFinderStore.getState();

function createEditor() {
  const parent = document.createElement('div');
  document.body.append(parent);
  return { parent, view: new EditorView({ extensions: [regionExit()], parent }) };
}

describe('regionExit', () => {
  let editor: ReturnType<typeof createEditor> | undefined;

  beforeEach(() => {
    useFileFinderStore.setState(initialFileFinderState, true);
  });

  afterEach(() => {
    editor?.view.destroy();
    editor?.parent.remove();
    editor = undefined;
  });

  it('opens the file finder once with Ctrl-w then f', () => {
    editor = createEditor();
    let finderOpens = 0;
    const unsubscribe = useFileFinderStore.subscribe((state, previous) => {
      if (state.open && !previous.open) finderOpens += 1;
    });

    editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 'w' }));
    editor.view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'f' }));

    unsubscribe();
    expect(useFileFinderStore.getState().open).toBe(true);
    expect(finderOpens).toBe(1);
  });
});
