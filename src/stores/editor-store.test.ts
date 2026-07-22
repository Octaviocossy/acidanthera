import { beforeEach, describe, expect, it } from 'vitest';
import { activeEditorBuffer, useEditorStore } from './editor-store';

function resetStore() {
  useEditorStore.setState({
    buffers: [
      {
        id: 'scratch-test',
        filePath: null,
        title: 'Untitled',
        content: '',
        dirty: false,
        revision: 0,
        savedRevision: 0,
        vimMode: 'normal',
      },
    ],
    activeBufferId: 'scratch-test',
    saveRequests: [],
  });
}

beforeEach(resetStore);

describe('openFile', () => {
  it('keeps a dirty scratch buffer while opening a saved file', () => {
    const store = useEditorStore.getState();
    store.updateBufferContent('scratch-test', 'unfinished');
    store.openFile('/vault/notes.md', '# Notes');

    expect(useEditorStore.getState().buffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'scratch-test', filePath: null, content: 'unfinished', dirty: true }),
        expect.objectContaining({ filePath: '/vault/notes.md', content: '# Notes', dirty: false }),
      ])
    );
  });

  it('activates an already-open saved buffer without replacing unsaved content', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');
    const bufferId = useEditorStore.getState().activeBufferId;
    store.updateBufferContent(bufferId, '# Changed');
    store.createScratchBuffer();
    store.openFile('/vault/notes.md', '# Stale disk version');

    expect(useEditorStore.getState().activeBufferId).toBe(bufferId);
    expect(activeEditorBuffer(useEditorStore.getState())).toMatchObject({ content: '# Changed', dirty: true });
  });
});

describe('requestSave', () => {
  it('captures an immutable snapshot and retains later edits as dirty', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/notes.md', '# Notes');
    const bufferId = useEditorStore.getState().activeBufferId;
    store.updateBufferContent(bufferId, '# First edit');
    store.requestSave();
    const [request] = useEditorStore.getState().saveRequests;
    store.updateBufferContent(bufferId, '# Later edit');
    store.completeSaveRequest(request);

    expect(request).toMatchObject({ bufferId, filePath: '/vault/notes.md', content: '# First edit', revision: 1 });
    expect(activeEditorBuffer(useEditorStore.getState())).toMatchObject({ content: '# Later edit', dirty: true, savedRevision: 1, revision: 2 });
  });

  it('queues requests in order for their individual buffers', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = useEditorStore.getState().activeBufferId;
    store.requestSave(one);
    store.openFile('/vault/two.md', 'two');
    const two = useEditorStore.getState().activeBufferId;
    store.requestSave(two);

    expect(useEditorStore.getState().saveRequests.map((request) => request.filePath)).toEqual(['/vault/one.md', '/vault/two.md']);
  });
});

describe('closeBuffer', () => {
  it('activates the next buffer when closing the active one', () => {
    const store = useEditorStore.getState();
    store.openFile('/vault/one.md', 'one');
    const one = useEditorStore.getState().activeBufferId;
    store.openFile('/vault/two.md', 'two');
    const two = useEditorStore.getState().activeBufferId;
    store.activateBuffer(one);

    store.closeBuffer(one);

    expect(useEditorStore.getState()).toMatchObject({ activeBufferId: two });
    expect(useEditorStore.getState().buffers.map((buffer) => buffer.id)).not.toContain(one);
  });

  it('replaces the final buffer with a clean scratch buffer', () => {
    useEditorStore.getState().closeBuffer('scratch-test');

    expect(useEditorStore.getState().buffers).toEqual([expect.objectContaining({ filePath: null, dirty: false, title: 'Untitled' })]);
  });
});
