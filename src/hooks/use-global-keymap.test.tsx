import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useGlobalKeymap } from './use-global-keymap';

const initialFileFinderState = useFileFinderStore.getState();

function GlobalKeymap() {
  useGlobalKeymap();
  return null;
}

function press(key: string, options: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options }));
}

describe('useGlobalKeymap', () => {
  beforeEach(() => {
    useFileFinderStore.setState(initialFileFinderState, true);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('opens the file finder with Ctrl-w then f', () => {
    render(<GlobalKeymap />);

    press('w', { ctrlKey: true });
    press('f');

    expect(useFileFinderStore.getState().open).toBe(true);
  });

  it('does not arm the file finder prefix from an editable target', () => {
    render(<GlobalKeymap />);
    const input = document.createElement('input');
    document.body.append(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 'w' }));
    press('f');

    expect(useFileFinderStore.getState().open).toBe(false);
  });

  it('does not arm the file finder prefix from a contenteditable target', () => {
    // CodeMirror's content DOM. Now that the editor actually holds DOM focus, this is the common
    // case, not a corner one — the window dispatcher must leave the editor's keys to CodeMirror.
    render(<GlobalKeymap />);
    const content = document.createElement('div');
    content.setAttribute('contenteditable', 'true');
    document.body.append(content);

    content.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 'w' }));
    press('f');

    expect(useFileFinderStore.getState().open).toBe(false);
  });
});
