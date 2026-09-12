import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { ReadView } from './ReadView';

/** Builds the buffer through the store rather than by hand so the `EditorBuffer` shape can never
 *  drift out of sync with `openFile`. */
function openBuffer(filePath: string, content = '# Note'): EditorBuffer {
  useEditorStore.getState().openFile(filePath, content);
  const buffer = useEditorStore.getState().buffers.find((candidate) => candidate.filePath === filePath);
  if (buffer === undefined) throw new Error('expected the buffer to be open');
  return buffer;
}

describe('ReadView', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer', editorFocusRequest: 0, vaultRoot: '/vault' });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
    useSidebarStore.setState({ tree: [] });
  });

  it('renders the in-memory buffer through the walker, so a dirty edit previews without a re-read', () => {
    const buffer = openBuffer('/vault/note.md');
    act(() => useEditorStore.getState().updateBufferContent(buffer.id, '## Typed just now'));
    const dirty = useEditorStore.getState().buffers[0];

    render(<ReadView buffer={dirty} active hidden={false} />);

    // A heading, not the `## Typed just now` source it was written as: the *markdown walker* is
    // what the buffer's content now goes through.
    expect(screen.getByRole('heading', { level: 2, name: 'Typed just now' })).toBeInTheDocument();
  });

  it('renders the note header block above the body', () => {
    render(<ReadView buffer={openBuffer('/vault/engineering/note.md', 'Prose with [[One]].')} active hidden={false} />);

    expect(screen.getByText('engineering / note.md')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'note' })).toBeInTheDocument();
    expect(screen.getByText('1 link · 1 min read')).toBeInTheDocument();
  });

  it('shows a note that opens with its own H1 exactly once', () => {
    render(<ReadView buffer={openBuffer('/vault/note.md', '# note\n\nProse.')} active hidden={false} />);

    // The header's title is the filename stem, so the body's leading heading is taken off the
    // source before the parse rather than rendered six pixels beneath it (spec decision 23).
    expect(screen.getAllByRole('heading', { name: 'note' })).toHaveLength(1);
    expect(screen.getByText('Prose.')).toBeInTheDocument();
  });

  it('states the edited time when the cached tree holds the note', () => {
    useSidebarStore.setState({ tree: [{ name: 'note.md', path: '/vault/note.md', isDir: false, modified: Date.now() - 61_000, children: null }] });

    render(<ReadView buffer={openBuffer('/vault/note.md', 'Prose.')} active hidden={false} />);

    expect(screen.getByText('edited 1m · 0 links · 1 min read')).toBeInTheDocument();
  });

  it('omits the edited time for a note the cached tree does not hold', () => {
    render(<ReadView buffer={openBuffer('/vault/note.md', 'Prose.')} active hidden={false} />);

    expect(screen.getByText('0 links · 1 min read')).toBeInTheDocument();
  });

  it('is hidden while the editor is the surface showing, and visible while it is', () => {
    const buffer = openBuffer('/vault/note.md');
    const { rerender } = render(<ReadView buffer={buffer} active hidden />);

    // Both surfaces stay mounted, so `hidden` is the entire mechanism keeping them from being
    // visible at once — the toggle's observable effect, not an implementation detail.
    expect(screen.getByLabelText('note.md, read view')).not.toBeVisible();

    rerender(<ReadView buffer={buffer} active hidden={false} />);

    expect(screen.getByLabelText('note.md, read view')).toBeVisible();
  });

  it('takes DOM focus when its buffer is active, showing, and the viewer is the focused region', () => {
    render(<ReadView buffer={openBuffer('/vault/note.md')} active hidden={false} />);

    expect(screen.getByLabelText('note.md, read view')).toHaveFocus();
  });

  it('does not take DOM focus while its buffer is inactive', () => {
    render(<ReadView buffer={openBuffer('/vault/note.md')} active={false} hidden={false} />);

    expect(screen.getByLabelText('note.md, read view')).not.toHaveFocus();
  });

  it('does not take DOM focus while the editor is the surface showing', () => {
    render(<ReadView buffer={openBuffer('/vault/note.md')} active hidden />);

    // The editor beside it is claiming focus instead; both are mounted, only one may hold it.
    expect(screen.getByLabelText('note.md, read view')).not.toHaveFocus();
  });

  it('does not take DOM focus while another region is focused', () => {
    useAppStore.setState({ activeRegion: 'sidebar' });
    render(<ReadView buffer={openBuffer('/vault/note.md')} active hidden={false} />);

    expect(screen.getByLabelText('note.md, read view')).not.toHaveFocus();
  });

  it('gives up DOM focus when the focused region leaves the viewer', () => {
    render(<ReadView buffer={openBuffer('/vault/note.md')} active hidden={false} />);

    act(() => useAppStore.getState().focusRegion('sidebar'));

    expect(screen.getByLabelText('note.md, read view')).not.toHaveFocus();
  });

  it('re-takes DOM focus for a repeat request that changes nothing else', () => {
    render(<ReadView buffer={openBuffer('/vault/note.md')} active hidden={false} />);
    const container = screen.getByLabelText('note.md, read view');
    act(() => container.blur());
    expect(container).not.toHaveFocus();

    act(() => useAppStore.getState().focusEditor());

    expect(container).toHaveFocus();
  });
});
