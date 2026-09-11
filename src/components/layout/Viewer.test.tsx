import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Viewer } from './Viewer';

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
    expect(screen.getByLabelText('note.md, read view')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows the editor status cluster while a buffer is open', () => {
    act(() => useEditorStore.getState().openFile('/vault/note.md', '# Note'));

    render(<Viewer />);

    expect(screen.getByText('ln 1 · col 1')).toBeInTheDocument();
    expect(screen.getByText('normal')).toBeInTheDocument();
  });
});
