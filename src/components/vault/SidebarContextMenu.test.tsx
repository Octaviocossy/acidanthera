import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAppStore } from '@/stores/app-store';
import { useContextMenuStore } from '@/stores/context-menu-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { SidebarContextMenu } from './SidebarContextMenu';

const { openVaultFile, readVaultTree, onVaultChanged } = vi.hoisted(() => ({
  openVaultFile: vi.fn(),
  readVaultTree: vi.fn(),
  onVaultChanged: vi.fn(),
}));

vi.mock('@/lib/vault/open-file', () => ({ openVaultFile }));
vi.mock('@/services/vault.service', () => ({ vaultService: { readVaultTree, onVaultChanged } }));

const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();
const initialContextMenuState = useContextMenuStore.getState();
const tree = [
  { name: 'notes', path: '/vault/notes', isDir: true, children: [{ name: 'ideas.md', path: '/vault/notes/ideas.md', isDir: false, children: null }] },
  { name: 'readme.md', path: '/vault/readme.md', isDir: false, children: null },
];

function renderSidebarWithMenu() {
  return render(
    <>
      <Sidebar />
      <SidebarContextMenu />
    </>
  );
}

describe('SidebarContextMenu', () => {
  beforeEach(() => {
    openVaultFile.mockReset();
    readVaultTree.mockResolvedValue(tree);
    onVaultChanged.mockResolvedValue(() => {});
    useAppStore.setState(initialAppState, true);
    useAppStore.setState({ vaultRoot: '/vault', sidebarExpanded: true });
    useSidebarStore.setState(initialSidebarState, true);
    useSidebarStore.setState({ tree, expanded: new Set(['/vault/notes']), cursorPath: null, draft: null });
    useContextMenuStore.setState(initialContextMenuState, true);
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(initialAppState, true);
    useSidebarStore.setState(initialSidebarState, true);
    useContextMenuStore.setState(initialContextMenuState, true);
  });

  it('opens for a row, suppresses the native menu, and moves the cursor to that row', () => {
    renderSidebarWithMenu();

    const didNotPreventDefault = fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'notes' }), { clientX: 80, clientY: 100 });

    expect(didNotPreventDefault).toBe(false);
    expect(screen.getByRole('menu', { name: 'Sidebar actions' })).toBeInTheDocument();
    expect(useSidebarStore.getState().cursorPath).toBe('/vault/notes');
  });

  it('opens from the empty background and creates a folder at the vault root', async () => {
    const user = userEvent.setup();
    renderSidebarWithMenu();

    fireEvent.contextMenu(screen.getByRole('tree', { name: 'Notes' }), { clientX: 80, clientY: 100 });
    await user.click(screen.getByRole('menuitem', { name: 'New folder' }));

    expect(useSidebarStore.getState().draft).toEqual({ kind: 'directory', parentPath: '/vault' });
  });

  it('creates a note inside a folder row selected by the menu', async () => {
    const user = userEvent.setup();
    renderSidebarWithMenu();

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'notes' }), { clientX: 80, clientY: 100 });
    await user.click(screen.getByRole('menuitem', { name: 'New note' }));

    expect(useSidebarStore.getState().draft).toEqual({ kind: 'note', parentPath: '/vault/notes' });
  });

  it('creates a note beside a file row selected by the menu', async () => {
    const user = userEvent.setup();
    renderSidebarWithMenu();

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'ideas.md' }), { clientX: 80, clientY: 100 });
    await user.click(screen.getByRole('menuitem', { name: 'New note' }));

    expect(useSidebarStore.getState().draft).toEqual({ kind: 'note', parentPath: '/vault/notes' });
  });

  it('dismisses on an outside mousedown', () => {
    renderSidebarWithMenu();
    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'notes' }), { clientX: 80, clientY: 100 });

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu', { name: 'Sidebar actions' })).not.toBeInTheDocument();
  });
});
