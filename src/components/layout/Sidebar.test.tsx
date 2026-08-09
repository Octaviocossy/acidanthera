import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Sidebar } from './Sidebar';

const { openVaultFile, readVaultTree, onVaultChanged } = vi.hoisted(() => ({
  openVaultFile: vi.fn(),
  readVaultTree: vi.fn(),
  onVaultChanged: vi.fn(),
}));

vi.mock('@/lib/vault/open-file', () => ({ openVaultFile }));
vi.mock('@/services/vault.service', () => ({ vaultService: { readVaultTree, onVaultChanged } }));

const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();
const tree = [
  { name: 'notes', path: '/vault/notes', isDir: true, children: [] },
  { name: 'readme.md', path: '/vault/readme.md', isDir: false, children: null },
];

describe('Sidebar', () => {
  beforeEach(() => {
    openVaultFile.mockReset();
    readVaultTree.mockResolvedValue(tree);
    onVaultChanged.mockResolvedValue(() => {});
    useAppStore.setState(initialAppState, true);
    useAppStore.setState({ vaultRoot: '/vault', sidebarExpanded: false });
    useSidebarStore.setState(initialSidebarState, true);
    useSidebarStore.setState({ tree, expanded: new Set(), cursorPath: null, draft: null });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(initialAppState, true);
    useSidebarStore.setState(initialSidebarState, true);
  });

  it('renders one accessible launcher for each root entry while collapsed', () => {
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'notes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'readme.md' })).toBeInTheDocument();
  });

  it('expands and unfolds a root directory selected from the rail', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'notes' }));

    expect(useAppStore.getState().sidebarExpanded).toBe(true);
    expect(useSidebarStore.getState().expanded).toContain('/vault/notes');
  });

  it('opens a root file selected from the rail without expanding it', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'readme.md' }));

    expect(openVaultFile).toHaveBeenCalledWith('/vault/readme.md');
    expect(useAppStore.getState().sidebarExpanded).toBe(false);
  });

  it('shows the vault path only while expanded', () => {
    const { rerender } = render(<Sidebar />);

    expect(screen.queryByText('/vault')).not.toBeInTheDocument();
    useAppStore.getState().expandSidebar();
    rerender(<Sidebar />);
    expect(screen.getByText('/vault')).toBeInTheDocument();
  });

  it('does not render a Config row in either state', () => {
    const { rerender } = render(<Sidebar />);

    expect(screen.queryByText('Config')).not.toBeInTheDocument();
    useAppStore.getState().expandSidebar();
    rerender(<Sidebar />);
    expect(screen.queryByText('Config')).not.toBeInTheDocument();
  });

  it('collapses from the expanded header control', async () => {
    const user = userEvent.setup();
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(useAppStore.getState().sidebarExpanded).toBe(false);
  });
});
