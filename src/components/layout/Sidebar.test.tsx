import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { resetTooltip } from '@/lib/tooltip/tooltip-overlay';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Sidebar } from './Sidebar';
import { TooltipHost } from './TooltipHost';

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
  { name: 'notes', path: '/vault/notes', isDir: true, modified: null, children: [] },
  { name: 'readme.md', path: '/vault/readme.md', isDir: false, modified: null, children: null },
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
    useKeymapStore.setState({ resolved: resolveKeymap(null) });
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

  it('shows the vault name and its recursive note count only while expanded', () => {
    const { rerender } = render(<Sidebar />);

    expect(screen.queryByText('vault')).not.toBeInTheDocument();
    useAppStore.getState().expandSidebar();
    rerender(<Sidebar />);

    expect(screen.getByText('vault')).toBeInTheDocument();
    expect(screen.getByText('1 note')).toBeInTheDocument();
  });

  it('reveals the full vault path from the footer identity block rather than printing it', () => {
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    expect(screen.queryByText('/vault')).not.toBeInTheDocument();
  });

  it('reaches settings and the agent toggle by pointer in both states', () => {
    const { rerender } = render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open AI agent' })).toBeInTheDocument();

    useAppStore.getState().expandSidebar();
    rerender(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agent' })).toBeInTheDocument();
  });

  it('toggles the agent panel from the primary nav and reflects it in aria-pressed', async () => {
    const user = userEvent.setup();
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);
    const agent = screen.getByRole('button', { name: 'Agent' });
    expect(agent).toHaveAttribute('aria-pressed', 'false');

    await user.click(agent);

    expect(screen.getByRole('button', { name: 'Agent' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts a draft from the primary nav, exactly as the sidebar chord does', async () => {
    const user = userEvent.setup();
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'New folder' }));

    expect(useSidebarStore.getState().draft).toEqual({ kind: 'directory', parentPath: '/vault' });
  });

  it('renders the primary nav chords from the resolved keymap rather than as literals', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'sidebar.new-note': ['ctrl-n'] }) });
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'New note' })).toHaveTextContent('Ctrl+n');
  });

  it('keeps the primary nav out of the cursor row source', () => {
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    // `j`/`k` walk the tree alone: only the two vault entries are rows under the tree.
    expect(screen.getByRole('tree').textContent).not.toContain('New note');
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

  describe('hover reveal', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      useAppStore.setState({ sidebarExpanded: true });
    });

    afterEach(() => {
      resetTooltip();
      useKeymapStore.setState({ resolved: resolveKeymap(null) });
      vi.useRealTimers();
    });

    it('reveals the full name of a clipped tree row once the hover delay elapses', () => {
      render(
        <>
          <Sidebar />
          <TooltipHost />
        </>
      );
      const label = screen.getByText('readme.md');
      Object.defineProperty(label, 'scrollWidth', { value: 200, configurable: true });
      Object.defineProperty(label, 'clientWidth', { value: 100, configurable: true });

      fireEvent.pointerOver(label);
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByRole('tooltip')).toHaveTextContent('readme.md');
    });

    it('reveals nothing for a tree row whose name already fits', () => {
      render(
        <>
          <Sidebar />
          <TooltipHost />
        </>
      );

      fireEvent.pointerOver(screen.getByText('readme.md'));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it("reveals a chrome control's label beside the chord the resolved keymap currently binds", () => {
      // Rebound rather than asserted against the default: the point of deriving the hint from
      // the resolved keymap is that editing `keymaps.toml` changes what the reveal shows.
      useKeymapStore.setState({ resolved: resolveKeymap({ 'global.find-file': ['ctrl-p'] }) });
      render(
        <>
          <Sidebar />
          <TooltipHost />
        </>
      );

      fireEvent.pointerOver(screen.getByRole('button', { name: 'Find file' }));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByRole('tooltip')).toHaveTextContent('Find fileCtrl+p');
    });

    it('dismisses an open reveal on a keydown, so it never floats above a keyboard-opened dialog', () => {
      render(
        <>
          <Sidebar />
          <TooltipHost />
        </>
      );
      const label = screen.getByText('readme.md');
      Object.defineProperty(label, 'scrollWidth', { value: 200, configurable: true });
      Object.defineProperty(label, 'clientWidth', { value: 100, configurable: true });

      fireEvent.pointerOver(label);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      act(() => {
        fireEvent.keyDown(window, { key: 'd' });
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
