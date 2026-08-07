import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { regionExit } from './region-exit';

const initialFileFinderState = useFileFinderStore.getState();
const initialKeymapState = useKeymapStore.getState();

function createEditor() {
  const parent = document.createElement('div');
  document.body.append(parent);
  return { parent, view: new EditorView({ extensions: [regionExit()], parent }) };
}

function ctrlW(view: EditorView) {
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 'w' }));
}

function press(view: EditorView, key: string, mods: Partial<KeyboardEventInit> = {}) {
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...mods }));
}

describe('regionExit', () => {
  let editor: ReturnType<typeof createEditor> | undefined;

  beforeEach(() => {
    useFileFinderStore.setState(initialFileFinderState, true);
    useKeymapStore.setState(initialKeymapState, true);
  });

  afterEach(() => {
    editor?.view.destroy();
    editor?.parent.remove();
    editor = undefined;
    useKeymapStore.setState(initialKeymapState, true);
    vi.restoreAllMocks();
  });

  it('opens the file finder once with Ctrl-w then f', () => {
    editor = createEditor();
    let finderOpens = 0;
    const unsubscribe = useFileFinderStore.subscribe((state, previous) => {
      if (state.open && !previous.open) finderOpens += 1;
    });

    ctrlW(editor.view);
    press(editor.view, 'f');

    unsubscribe();
    expect(useFileFinderStore.getState().open).toBe(true);
    expect(finderOpens).toBe(1);
  });

  it('reads its completion keys from the resolved keymap, not a hardcoded literal', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.focus-next': ['ctrl-w k'] }) });
    editor = createEditor();
    const focusNext = vi.spyOn(useAppStore.getState(), 'focusNext');

    // The old default ("l") no longer completes the gesture...
    ctrlW(editor.view);
    press(editor.view, 'l');
    expect(focusNext).not.toHaveBeenCalled();

    // ...but the configured replacement ("k") does.
    ctrlW(editor.view);
    press(editor.view, 'k');
    expect(focusNext).toHaveBeenCalledTimes(1);
  });

  it('leaves a command unreachable from inside the editor when its chord is unbound', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.find-file': [] }) });
    editor = createEditor();
    let finderOpens = 0;
    const unsubscribe = useFileFinderStore.subscribe((state, previous) => {
      if (state.open && !previous.open) finderOpens += 1;
    });

    ctrlW(editor.view);
    press(editor.view, 'f');

    unsubscribe();
    expect(finderOpens).toBe(0);
  });
});
