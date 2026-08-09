import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAppStore } from '@/stores/app-store';
import { useContextMenuStore } from '@/stores/context-menu-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { SidebarContextMenu } from './SidebarContextMenu';

const { invoke, listen, openVaultFile } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  openVaultFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen }));
vi.mock('@/lib/vault/open-file', () => ({ openVaultFile }));

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
    invoke.mockImplementation((command: string) => {
      if (command === 'read_vault_tree') return Promise.resolve(tree);
      if (command === 'duplicate_entry') return Promise.resolve('/vault/notes/ideas copy.md');
      return Promise.resolve();
    });
    listen.mockResolvedValue(() => {});
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
    expect(screen.queryByRole('menuitem', { name: 'Move to Trash' })).not.toBeInTheDocument();
  });

  it('shows only the creation rows on the tree background', () => {
    renderSidebarWithMenu();

    fireEvent.contextMenu(screen.getByRole('tree', { name: 'Notes' }), { clientX: 80, clientY: 100 });

    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByRole('menuitem', { name: 'New note' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
  });

  it('shows entry actions but not AI placeholders for a directory', () => {
    renderSidebarWithMenu();

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'notes' }), { clientX: 80, clientY: 100 });

    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Move to Trash' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Summarize note' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Find related notes' })).not.toBeInTheDocument();
  });

  it('shows all seven rows and marks AI placeholders unavailable for a note', () => {
    renderSidebarWithMenu();

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'ideas.md' }), { clientX: 80, clientY: 100 });

    expect(screen.getAllByRole('menuitem')).toHaveLength(7);
    expect(screen.getByRole('menuitem', { name: 'Summarize note' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Find related notes' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('duplicates through the Tauri invoke boundary', async () => {
    const user = userEvent.setup();
    renderSidebarWithMenu();

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'ideas.md' }), { clientX: 80, clientY: 100 });
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('duplicate_entry', { path: '/vault/notes/ideas.md' }));
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
