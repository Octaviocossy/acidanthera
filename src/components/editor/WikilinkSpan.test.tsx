import { invoke } from '@tauri-apps/api/core';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { WikilinkSpan } from './WikilinkSpan';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

function note(path: string): VaultEntry {
  return { name: path.slice(path.lastIndexOf('/') + 1), path, isDir: false, modified: null, children: null };
}

describe('WikilinkSpan', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useSidebarStore.setState({ tree: [note('/vault/Alpha.md')] });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
    useAppStore.setState({ activeRegion: 'viewer', editorFocusRequest: 0 });
  });

  it('renders a resolved target as a link that opens the note', async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockResolvedValueOnce('# Alpha');

    render(<WikilinkSpan raw="[[Alpha]]" />);
    await user.click(screen.getByRole('link', { name: 'Alpha' }));

    expect(invoke).toHaveBeenCalledWith('read_note', { path: '/vault/Alpha.md' });
    expect(useEditorStore.getState().buffers).toContainEqual(expect.objectContaining({ filePath: '/vault/Alpha.md' }));
  });

  it('renders a missing target as inert struck-through text', async () => {
    const user = userEvent.setup();

    render(<WikilinkSpan raw="[[Gamma]]" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const span = screen.getByTitle('no note with this name');
    expect(span).toHaveTextContent('Gamma');
    await user.click(span);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('renders an ambiguous target as inert rather than opening the first match', async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ tree: [note('/vault/Alpha.md'), note('/vault/archive/Alpha.md')] });

    render(<WikilinkSpan raw="[[Alpha]]" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await user.click(screen.getByTitle('two notes share this name'));
    expect(invoke).not.toHaveBeenCalled();
    expect(useEditorStore.getState().buffers).toHaveLength(0);
  });

  it('shows the alias rather than the target, and still resolves the target', () => {
    render(<WikilinkSpan raw="[[Alpha#Intro|the first one]]" />);

    expect(screen.getByRole('link', { name: 'the first one' })).toBeInTheDocument();
  });

  it('stops reading broken the moment the missing note appears', () => {
    render(<WikilinkSpan raw="[[Beta]]" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    // What a `vault-changed` refresh does: the tree is replaced, and nothing else.
    act(() => useSidebarStore.setState({ tree: [note('/vault/Alpha.md'), note('/vault/Beta.md')] }));

    expect(screen.getByRole('link', { name: 'Beta' })).toBeInTheDocument();
  });
});
