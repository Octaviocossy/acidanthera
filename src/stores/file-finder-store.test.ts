import { beforeEach, describe, expect, it } from 'vitest';
import { useFileFinderStore } from './file-finder-store';

const initialState = useFileFinderStore.getState();

beforeEach(() => {
  useFileFinderStore.setState(initialState, true);
});

describe('useFileFinderStore', () => {
  it('opens with a fresh query and cursor', () => {
    useFileFinderStore.getState().setQuery('old');
    useFileFinderStore.getState().moveCursor(2, 4);
    useFileFinderStore.getState().show();

    expect(useFileFinderStore.getState()).toMatchObject({ open: true, query: '', cursor: 0 });
  });

  it('resets the cursor when the query changes', () => {
    useFileFinderStore.getState().show();
    useFileFinderStore.getState().moveCursor(2, 4);
    useFileFinderStore.getState().setQuery('notes');

    expect(useFileFinderStore.getState()).toMatchObject({ query: 'notes', cursor: 0 });
  });

  it('clamps cursor movement to the available results', () => {
    useFileFinderStore.getState().moveCursor(3, 2);
    expect(useFileFinderStore.getState().cursor).toBe(1);
    useFileFinderStore.getState().moveCursor(-3, 2);
    expect(useFileFinderStore.getState().cursor).toBe(0);
  });

  it('keeps the last query and cursor when it closes, for the exit phase', () => {
    useFileFinderStore.getState().show();
    useFileFinderStore.getState().setQuery('notes');
    useFileFinderStore.getState().moveCursor(1, 4);
    useFileFinderStore.getState().hide();

    expect(useFileFinderStore.getState()).toMatchObject({ open: false, query: 'notes', cursor: 1 });
  });
});
