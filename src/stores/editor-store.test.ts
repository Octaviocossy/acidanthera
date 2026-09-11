import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_NAVIGATION_HISTORY } from '@/lib/editor/navigation-history';
import { activeEditorBuffer, useEditorStore } from './editor-store';

function resetStore() {
  useEditorStore.setState({
    buffers: [],
    activeBufferId: null,
    saveRequests: [],
    history: EMPTY_NAVIGATION_HISTORY,
  });
}

function getActiveBufferId(): string {
  const bufferId = useEditorStore.getState().activeBufferId;
  if (bufferId === null) throw new Error('expected an active buffer');
  return bufferId;
}

beforeEach(resetStore);

describe('openFile', () => {
  it('opens a saved file from an empty editor', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');

    expect(useEditorStore.getState()).toMatchObject({
      buffers: [expect.objectContaining({ filePath: '/vault/notes.md', content: '# Notes', dirty: false })],
      activeBufferId: expect.any(String),
    });
  });

  it('activates an already-open saved buffer without replacing unsaved content', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');
    const bufferId = getActiveBufferId();
    store.updateBufferContent(bufferId, '# Changed');
    store.openFile('/vault/notes.md', '# Stale disk version');

    expect(useEditorStore.getState().activeBufferId).toBe(bufferId);
    expect(activeEditorBuffer(useEditorStore.getState())).toMatchObject({ content: '# Changed', dirty: true });
  });

  it('defaults a new buffer to the vault source', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');

    expect(activeEditorBuffer(useEditorStore.getState())).toMatchObject({ source: 'vault' });
  });

  it('opens a config buffer with the config source, tagged on the buffer', () => {
    const store = useEditorStore.getState();
    store.openFile('settings.toml', 'theme = "dark"', 'config');

    expect(activeEditorBuffer(useEditorStore.getState())).toMatchObject({ filePath: 'settings.toml', source: 'config' });
  });
});

describe('requestSave', () => {
  it('captures an immutable snapshot and retains later edits as dirty', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');
    const bufferId = getActiveBufferId();
    store.updateBufferContent(bufferId, '# First edit');
    store.requestSave();
    const [request] = useEditorStore.getState().saveRequests;
    store.updateBufferContent(bufferId, '# Later edit');
    store.completeSaveRequest(request);

    expect(request).toMatchObject({ bufferId, filePath: '/vault/notes.md', content: '# First edit', revision: 1, source: 'vault' });
    expect(activeEditorBuffer(useEditorStore.getState())).toMatchObject({ content: '# Later edit', dirty: true, savedRevision: 1, revision: 2 });
  });

  it('queues requests in order for their individual buffers', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = getActiveBufferId();
    store.requestSave(one);
    store.openFile('/vault/two.md', 'two');
    const two = getActiveBufferId();
    store.requestSave(two);

    expect(useEditorStore.getState().saveRequests.map((request) => request.filePath)).toEqual(['/vault/one.md', '/vault/two.md']);
  });
});

describe('closeBuffer', () => {
  it('activates the next buffer when closing the active one', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = getActiveBufferId();
    store.openFile('/vault/two.md', 'two');
    const two = getActiveBufferId();
    store.activateBuffer(one);

    store.closeBuffer(one);

    expect(useEditorStore.getState()).toMatchObject({ activeBufferId: two });
    expect(useEditorStore.getState().buffers.map((buffer) => buffer.id)).not.toContain(one);
  });

  it('leaves the editor empty when closing the final buffer', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const bufferId = getActiveBufferId();
    store.closeBuffer(bufferId);

    expect(useEditorStore.getState()).toMatchObject({ buffers: [], activeBufferId: null });
  });
});

describe('closeBuffersUnder', () => {
  it('closes only vault buffers at the target boundary and preserves the existing activation behavior', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes/one.md', 'one');
    const one = getActiveBufferId();
    store.openFile('/vault/notes/two.md', 'two');
    const two = getActiveBufferId();
    store.openFile('/vault/notebook.md', 'sibling');
    const sibling = getActiveBufferId();
    store.openFile('/vault/notes/settings.toml', 'settings', 'config');
    const config = getActiveBufferId();
    store.activateBuffer(one);

    store.closeBuffersUnder('/vault/notes');

    expect(useEditorStore.getState().buffers.map((buffer) => buffer.id)).toEqual([sibling, config]);
    expect(useEditorStore.getState().activeBufferId).toBe(sibling);
    expect(useEditorStore.getState().buffers.map((buffer) => buffer.id)).not.toContain(two);
  });
});

describe('rewriteBufferPaths', () => {
  it('moves dirty vault buffers at and under a renamed directory without changing their content or dirty state', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes/one.md', 'one');
    const one = getActiveBufferId();
    store.updateBufferContent(one, 'changed');
    store.openFile('/vault/notes/nested/two.md', 'two');
    store.openFile('/vault/notebook.md', 'sibling');

    store.rewriteBufferPaths('/vault/notes', '/vault/archive');

    expect(useEditorStore.getState().buffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: one, filePath: '/vault/archive/one.md', title: 'one.md', content: 'changed', dirty: true }),
        expect.objectContaining({ filePath: '/vault/archive/nested/two.md', title: 'two.md' }),
        expect.objectContaining({ filePath: '/vault/notebook.md' }),
      ])
    );
  });
});

describe('navigation history', () => {
  it('records an activation of a newly opened file', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    store.openFile('/vault/two.md', 'two');

    expect(useEditorStore.getState().history).toEqual({ entries: ['/vault/one.md', '/vault/two.md'], index: 1 });
  });

  it('records an activation of an already-open buffer', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = getActiveBufferId();
    store.openFile('/vault/two.md', 'two');
    store.activateBuffer(one);

    expect(useEditorStore.getState().history).toEqual({ entries: ['/vault/one.md', '/vault/two.md', '/vault/one.md'], index: 2 });
  });

  it('records nothing when the already-active buffer is re-activated', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = getActiveBufferId();
    store.activateBuffer(one);
    store.openFile('/vault/one.md', 'stale disk version');

    expect(useEditorStore.getState().history).toEqual({ entries: ['/vault/one.md'], index: 0 });
  });

  it('records nothing when closing a buffer activates another one', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    store.openFile('/vault/two.md', 'two');
    const two = getActiveBufferId();

    store.closeBuffer(two);

    expect(useEditorStore.getState().activeBufferId).not.toBe(two);
    expect(useEditorStore.getState().history).toEqual({ entries: ['/vault/one.md', '/vault/two.md'], index: 1 });
  });

  it('activates the previous buffer on goBack and returns on goForward', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = getActiveBufferId();
    store.openFile('/vault/two.md', 'two');
    const two = getActiveBufferId();

    store.goBack();
    expect(useEditorStore.getState().activeBufferId).toBe(one);

    store.goForward();
    expect(useEditorStore.getState().activeBufferId).toBe(two);
  });

  it('discards the forward branch once a new file is opened after going back', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    store.openFile('/vault/two.md', 'two');
    store.openFile('/vault/three.md', 'three');
    store.goBack();
    store.goBack();
    store.openFile('/vault/four.md', 'four');

    expect(useEditorStore.getState().history).toEqual({ entries: ['/vault/one.md', '/vault/four.md'], index: 1 });
  });

  it('skips and drops an entry whose buffer was closed in the meantime', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = getActiveBufferId();
    store.openFile('/vault/two.md', 'two');
    const two = getActiveBufferId();
    store.openFile('/vault/three.md', 'three');
    store.closeBuffer(two);

    store.goBack();

    expect(useEditorStore.getState().activeBufferId).toBe(one);
    expect(useEditorStore.getState().history).toEqual({ entries: ['/vault/one.md', '/vault/three.md'], index: 0 });
  });

  it('empties the stack on clearHistory', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    store.openFile('/vault/two.md', 'two');

    store.clearHistory();

    expect(useEditorStore.getState().history).toEqual({ entries: [], index: -1 });
  });
});

describe('buffer view', () => {
  it('opens a vault note in read, the view a note is read in', () => {
    useEditorStore.getState().openFile('/vault/notes.md', '# Notes');

    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('read');
  });

  it('opens a note its caller just created in edit', () => {
    useEditorStore.getState().openFile('/vault/fresh.md', '', 'vault', 'edit');

    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('edit');
  });

  it('forces a config buffer to edit even when read is asked for', () => {
    useEditorStore.getState().openFile('settings.toml', 'theme = "dark"', 'config', 'read');

    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('edit');
  });

  it('leaves an already-open buffer in whatever view it was left in', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');
    store.toggleActiveBufferView();

    store.openFile('/vault/notes.md', '# Notes', 'vault', 'read');

    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('edit');
  });

  it('flips the active vault buffer both ways', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');

    store.toggleActiveBufferView();
    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('edit');

    store.toggleActiveBufferView();
    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('read');
  });

  it('does not flip a config buffer, which has no read view to flip into', () => {
    const store = useEditorStore.getState();
    store.openFile('settings.toml', 'theme = "dark"', 'config');

    store.toggleActiveBufferView();

    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('edit');
  });

  it('leaves every other buffer alone when one is toggled', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = getActiveBufferId();
    store.openFile('/vault/two.md', 'two');

    store.toggleActiveBufferView();

    expect(useEditorStore.getState().buffers.find((buffer) => buffer.id === one)?.view).toBe('read');
  });

  it('does nothing with no buffer open', () => {
    useEditorStore.getState().toggleActiveBufferView();

    expect(useEditorStore.getState().buffers).toEqual([]);
  });
});
