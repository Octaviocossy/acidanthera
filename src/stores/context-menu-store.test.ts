import { afterEach, describe, expect, it } from 'vitest';
import { useContextMenuStore } from './context-menu-store';

const initialState = useContextMenuStore.getState();

describe('useContextMenuStore', () => {
  afterEach(() => {
    useContextMenuStore.setState(initialState, true);
  });

  it('keeps the coordinates and target on hide, which the exit phase still renders', () => {
    useContextMenuStore.getState().show(80, 100, '/vault/notes');

    useContextMenuStore.getState().hide();

    expect(useContextMenuStore.getState()).toMatchObject({ open: false, x: 80, y: 100, target: '/vault/notes' });
  });
});
