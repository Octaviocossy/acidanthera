import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Viewer } from './Viewer';

describe('Viewer', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer' });
    useEditorStore.setState({ buffers: [], activeBufferId: null, cursor: { line: 1, col: 1 }, saveRequests: [] });
    useSidebarStore.setState({ tree: [] });
  });

  it('shows the branded empty state when no notes are open', () => {
    render(<Viewer />);

    expect(screen.getByText('acidanthera')).toBeInTheDocument();
    expect(screen.getByText('Your vault is empty. Good — clean slate.')).toBeInTheDocument();
    expect(screen.getByText('Ctrl-w f')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/ln 1 · col 1/)).not.toBeInTheDocument();
    expect(screen.queryByText('normal')).not.toBeInTheDocument();
  });

  it('shows a neutral empty-editor line when the vault has notes', () => {
    useSidebarStore.setState({ tree: [{ name: 'note.md', path: '/vault/note.md', isDir: false, children: null }] });

    render(<Viewer />);

    expect(screen.getByText('No note open.')).toBeInTheDocument();
  });

  it('shows the editor status cluster while a buffer is open', () => {
    act(() => useEditorStore.getState().openFile('/vault/note.md', '# Note'));

    render(<Viewer />);

    expect(screen.getByText('ln 1 · col 1')).toBeInTheDocument();
    expect(screen.getByText('normal')).toBeInTheDocument();
  });
});
