import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { ReadView } from './ReadView';

/** Builds the buffer through the store so the `EditorBuffer` shape cannot drift from `openFile`. */
function openBuffer(content: string): EditorBuffer {
  useEditorStore.getState().openFile('/vault/tasks.md', content);
  const buffer = useEditorStore.getState().buffers.find((candidate) => candidate.filePath === '/vault/tasks.md');
  if (buffer === undefined) throw new Error('expected the buffer to be open');
  return buffer;
}

function currentBuffer(): EditorBuffer {
  const buffer = useEditorStore.getState().buffers[0];
  if (buffer === undefined) throw new Error('expected the buffer to be open');
  return buffer;
}

/** Re-renders with the buffer as it now stands, the way `BufferPane` does on a store change. */
function renderBuffer(buffer: EditorBuffer) {
  const { rerender } = render(<ReadView buffer={buffer} active hidden={false} />);
  return () => rerender(<ReadView buffer={currentBuffer()} active hidden={false} />);
}

describe('ReadView task checkboxes', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer', editorFocusRequest: 0, vaultRoot: '/vault' });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
  });

  it('rewrites the marker and marks the buffer dirty when a box is ticked', async () => {
    const buffer = openBuffer('# Tasks\n\n- [ ] buy milk\n- [x] pay rent\n');
    renderBuffer(buffer);

    await userEvent.click(screen.getByRole('checkbox', { name: 'buy milk' }));

    // The write lands in the buffer, never on disk: dirty, with no save request raised — `:w` is
    // still what commits it, through the lifecycle every other edit already goes through.
    expect(currentBuffer().content).toBe('# Tasks\n\n- [x] buy milk\n- [x] pay rent\n');
    expect(currentBuffer().dirty).toBe(true);
    expect(useEditorStore.getState().saveRequests).toEqual([]);
  });

  it('shows the new state in the rendered output, and reverts it on a second click', async () => {
    const buffer = openBuffer('- [ ] buy milk\n');
    const rerender = renderBuffer(buffer);

    await userEvent.click(screen.getByRole('checkbox', { name: 'buy milk' }));
    rerender();

    expect(screen.getByRole('checkbox', { name: 'buy milk' })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'buy milk' }));
    rerender();

    expect(screen.getByRole('checkbox', { name: 'buy milk' })).not.toBeChecked();
    expect(currentBuffer().content).toBe('- [ ] buy milk\n');
  });

  it('leaves the rest of the note byte-identical, so the edit view shows only the rewritten line', async () => {
    const source = '# Tasks\n\n> a quote\n\n- [ ] one\n- [ ] two\n\n`- [ ] not a task`\n';
    renderBuffer(openBuffer(source));

    await userEvent.click(screen.getByRole('checkbox', { name: 'two' }));

    expect(currentBuffer().content).toBe('# Tasks\n\n> a quote\n\n- [ ] one\n- [x] two\n\n`- [ ] not a task`\n');
  });

  it('ticks the box that was clicked when several tasks share their text', async () => {
    renderBuffer(openBuffer('- [ ] repeat\n- [ ] repeat\n'));

    // Offsets come from the parse, so two identically-worded rows are still distinct targets —
    // which a rewrite driven by a text search could not manage.
    await userEvent.click(screen.getAllByRole('checkbox')[1]);

    expect(currentBuffer().content).toBe('- [ ] repeat\n- [x] repeat\n');
  });

  it('writes nothing else — the rendered prose stays non-editable', async () => {
    renderBuffer(openBuffer('# Tasks\n\n- [ ] buy milk\n\nSome prose.\n'));

    await userEvent.click(screen.getByText('Some prose.'));
    await userEvent.keyboard('typed');

    // The one write is the checkbox; nothing else in the read view accepts input (invariant 37).
    expect(currentBuffer().content).toBe('# Tasks\n\n- [ ] buy milk\n\nSome prose.\n');
    expect(currentBuffer().dirty).toBe(false);
  });

  // The interaction between this slice and the *note header block*: `ReadView` strips a leading
  // `# H1` before parsing, so every offset the walker reports is short by that heading's width,
  // while the buffer rewritten here is the original. Without `stripLeadingH1`'s offset added back,
  // the marker range lands to the left of the real one, `toggleTaskAt` refuses to recognise it, and
  // the checkbox goes silently inert in a note that opens with a title — which is most of them.
  // Several tests above happen to cover this by using `# Tasks`; this one names it.
  it('ticks the right marker in a note whose leading H1 the header block strips', async () => {
    const source = '# Groceries\n\n- [ ] buy milk\n- [ ] pay rent\n';
    renderBuffer(openBuffer(source));

    await userEvent.click(screen.getByRole('checkbox', { name: 'pay rent' }));

    expect(currentBuffer().content).toBe('# Groceries\n\n- [ ] buy milk\n- [x] pay rent\n');
  });

  it('ticks the right marker when the stripped heading is unusually long', async () => {
    // The offset is the heading's own width, not a constant, so a long title shifts further.
    const source = '#' + ' A rather long note title that shifts every offset'.repeat(2) + '\n\n- [ ] one\n';
    renderBuffer(openBuffer(source));

    await userEvent.click(screen.getByRole('checkbox', { name: 'one' }));

    expect(currentBuffer().content).toBe(source.replace('- [ ] one', '- [x] one'));
  });
});
