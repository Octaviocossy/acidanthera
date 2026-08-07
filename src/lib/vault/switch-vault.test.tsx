import { invoke } from '@tauri-apps/api/core';
import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SwitchVaultDialog } from '@/components/layout/SwitchVaultDialog';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { switchVault } from './switch-vault';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const initialAppState = useAppStore.getState();
const initialEditorState = useEditorStore.getState();

beforeEach(() => {
  useAppStore.setState(initialAppState, true);
  useEditorStore.setState(initialEditorState, true);
  vi.mocked(invoke).mockReset();
  cleanup();
});

describe('switchVault', () => {
  it('cancels the switch and leaves the vault open and buffers dirty when the user cancels the consolidated prompt', async () => {
    useAppStore.setState({ vaultRoot: '/old-vault' });
    useEditorStore.getState().openFile('/old-vault/note.md', '# original');
    const bufferId = useEditorStore.getState().activeBufferId;
    if (bufferId === null) throw new Error('expected a buffer');
    useEditorStore.getState().updateBufferContent(bufferId, '# unsaved edit');

    render(<SwitchVaultDialog />);
    const switching = switchVault('/new-vault');

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    expect(screen.getByText('/new-vault')).toBeInTheDocument();
    cancelButton.click();

    const outcome = await switching;

    expect(outcome).toBe('cancelled');
    expect(useAppStore.getState().vaultRoot).toBe('/old-vault');
    expect(useEditorStore.getState().buffers).toHaveLength(1);
    expect(useEditorStore.getState().buffers[0]).toMatchObject({ content: '# unsaved edit', dirty: true });
    expect(invoke).not.toHaveBeenCalledWith('open_vault', expect.anything());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('discards dirty buffers and switches when the user discards', async () => {
    useAppStore.setState({ vaultRoot: '/old-vault' });
    useEditorStore.getState().openFile('/old-vault/note.md', '# original');
    const bufferId = useEditorStore.getState().activeBufferId;
    if (bufferId === null) throw new Error('expected a buffer');
    useEditorStore.getState().updateBufferContent(bufferId, '# unsaved edit');
    vi.mocked(invoke).mockResolvedValueOnce('/new-vault'); // open_vault

    render(<SwitchVaultDialog />);
    const switching = switchVault('/new-vault');

    const discardButton = await screen.findByRole('button', { name: 'Discard all' });
    discardButton.click();

    const outcome = await switching;

    expect(outcome).toBe('switched');
    expect(useAppStore.getState().vaultRoot).toBe('/new-vault');
    expect(useEditorStore.getState().buffers).toHaveLength(0);
  });

  it('switches immediately when there are no dirty buffers, without showing a prompt', async () => {
    useAppStore.setState({ vaultRoot: '/old-vault' });
    vi.mocked(invoke).mockResolvedValueOnce('/new-vault'); // open_vault

    render(<SwitchVaultDialog />);
    const outcome = await switchVault('/new-vault');

    expect(outcome).toBe('switched');
    expect(useAppStore.getState().vaultRoot).toBe('/new-vault');
    expect(invoke).toHaveBeenCalledWith('open_vault', { path: '/new-vault' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
