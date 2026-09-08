import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatChord } from '@/lib/keymap/format-chord';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Viewer } from './Viewer';

describe('Viewer', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer' });
    useEditorStore.setState({ buffers: [], activeBufferId: null, cursor: { line: 1, col: 1 }, saveRequests: [] });
    useSidebarStore.setState({ tree: [] });
    useKeymapStore.setState({ resolved: resolveKeymap(null) });
  });

  it('shows the branded empty state when no notes are open', () => {
    render(<Viewer />);

    expect(screen.getByText('acidanthera')).toBeInTheDocument();
    expect(screen.getByText('Your vault is empty. Good — clean slate.')).toBeInTheDocument();
    const findFileChord = formatChord(useKeymapStore.getState().resolved.layers.global.get('global.find-file'));
    expect(findFileChord).toBeDefined();
    expect(screen.getByText(findFileChord as string)).toBeInTheDocument();
    // The chrome strip still reserves its 40px, so the empty state never slides under the
    // traffic lights — it just holds no tabs.
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/ln 1 · col 1/)).not.toBeInTheDocument();
    expect(screen.queryByText('normal')).not.toBeInTheDocument();
  });

  it('renders the find-file hint from the resolved keymap, so a rebind reaches it', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.find-file': ['ctrl-p'] }) });

    render(<Viewer />);

    expect(screen.getByText('Ctrl+p')).toBeInTheDocument();
  });

  it('omits the find-file hint entirely when the command is unbound', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.find-file': [] }) });

    render(<Viewer />);

    expect(screen.queryByText('Ctrl+wf')).not.toBeInTheDocument();
  });

  it('shows a neutral empty-editor line when the vault has notes', () => {
    useSidebarStore.setState({ tree: [{ name: 'note.md', path: '/vault/note.md', isDir: false, modified: null, children: null }] });

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
