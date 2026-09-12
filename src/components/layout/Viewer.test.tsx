import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Viewer } from './Viewer';

/**
 * Asserts that nothing on screen states a read time.
 *
 * Scoped to visibility rather than to the document, because the read view stays **mounted** beside
 * the editor with its `hidden` attribute set (spec decision 6) and its *note header block* states a
 * read time of its own. What the editing state must not show is a *visible* one — the claim these
 * tests were written to make about the *editor status cluster*.
 */
function expectNoVisibleReadTime() {
  for (const node of screen.queryAllByText(/min read/)) expect(node).not.toBeVisible();
}

describe('Viewer', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer', vaultRoot: '/vault' });
    useEditorStore.setState({ buffers: [], activeBufferId: null, cursor: { line: 1, col: 1 }, saveRequests: [] });
    useSidebarStore.setState({ tree: [] });
    useKeymapStore.setState({ resolved: resolveKeymap(null) });
  });

  // The three states, the greeting copy and each row's dispatch belong to `HomeSurface.test.tsx`;
  // what the viewer owns is only that the zero-buffer branch renders it at all.
  it('renders the home surface when no buffer is open', () => {
    render(<Viewer />);

    expect(screen.getByText('acidanthera')).toBeInTheDocument();
    // The chrome strip still reserves its 40px, so the home surface never slides under the
    // traffic lights — it just holds no tabs.
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/ln 1 · col 1/)).not.toBeInTheDocument();
    expect(screen.queryByText('normal')).not.toBeInTheDocument();
  });

  it('moves a full border onto the editor card only while the viewer region is focused', () => {
    const { rerender } = render(<Viewer />);

    expect(screen.getByRole('main', { name: 'Editor' })).toHaveClass('rounded-panel', 'border-border-strong');

    act(() => {
      useAppStore.setState({ activeRegion: 'sidebar' });
    });
    rerender(<Viewer />);

    // A card that shares no edge with its neighbours carries the focus region on all four sides,
    // and steps back to a hairline rather than losing its outline (spec decisions 22, 38).
    const card = screen.getByRole('main', { name: 'Editor' });
    expect(card).toHaveClass('border-hairline');
    expect(card).not.toHaveClass('border-border-strong');
  });

  it('mounts both surfaces of a buffer, so a toggle never unmounts CodeMirror', () => {
    act(() => useEditorStore.getState().openFile('/vault/note.md', '# Note'));

    render(<Viewer />);

    // The note opens in read, and the editor is hidden beside it rather than absent — which is what
    // keeps undo history and cursor position across a toggle (spec decision 6).
    expect(screen.getByLabelText('note.md, read view')).toBeVisible();
    expect(screen.getByRole('textbox', { hidden: true })).not.toBeVisible();
  });

  it('shows cursor position and the vim mode in the status cluster while editing', () => {
    act(() => useEditorStore.getState().openFile('/vault/note.md', '# Note', 'vault', 'edit'));

    render(<Viewer />);

    expect(screen.getByText('ln 1 · col 1')).toBeInTheDocument();
    expect(screen.getByText('normal')).toBeInTheDocument();
    expectNoVisibleReadTime();
  });

  it('shows the word count and read time in the status cluster while reading', () => {
    act(() => useEditorStore.getState().openFile('/vault/note.md', '# A short note'));

    render(<Viewer />);

    expect(screen.getByText('4 words · 1 min read')).toBeInTheDocument();
    // The cursor readout and the vim mode belong to the surface that has a cursor.
    expect(screen.queryByText(/^ln /)).not.toBeInTheDocument();
    expect(screen.queryByText('normal')).not.toBeInTheDocument();
  });

  it('swaps the cluster in place when the buffer view toggles, rather than adding a mode indicator', () => {
    act(() => useEditorStore.getState().openFile('/vault/note.md', '# A short note'));

    const { rerender } = render(<Viewer />);

    // The *view toggle* is the read view's only mode indicator (spec decision 29), so the word
    // never appears in the cluster — boxed or bare.
    expect(screen.queryByText('READ')).not.toBeInTheDocument();

    act(() => useEditorStore.getState().toggleActiveBufferView());
    rerender(<Viewer />);

    expect(screen.getByText('ln 1 · col 1')).toBeInTheDocument();
    expectNoVisibleReadTime();
  });
});
