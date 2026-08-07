import { beforeEach, describe, expect, it } from 'vitest';
import { activeEditorBuffer, useEditorStore } from './editor-store';

function resetStore() {
  useEditorStore.setState({
    buffers: [],
    activeBufferId: null,
    saveRequests: [],
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
