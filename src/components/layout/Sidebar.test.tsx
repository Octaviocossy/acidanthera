import { invoke } from '@tauri-apps/api/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { resetTooltip } from '@/lib/tooltip/tooltip-overlay';
import type { Settings } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSettingsStore } from '@/stores/settings-store';
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
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();
const initialSettingsState = useSettingsStore.getState();
const SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'Geist Mono', theme: 'dark', vaultPath: '/vault' };
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// Pinned relative to load so the rendered `edited` strings are deterministic: every elapsed value
// here sits well inside its bucket, so the milliseconds a test takes cannot move it.
const NOW = Date.now();
// `notes` holds no note directly — only a note-filled subdirectory — so its row's count is the
// recursive measure or nothing.
const tree = [
  {
    name: 'notes',
    path: '/vault/notes',
    isDir: true,
    modified: null,
    children: [
      {
        name: 'engineering',
        path: '/vault/notes/engineering',
        isDir: true,
        modified: null,
        children: [{ name: 'rust.md', path: '/vault/notes/engineering/rust.md', isDir: false, modified: NOW - 3 * MINUTE, children: null }],
      },
    ],
  },
  { name: 'readme.md', path: '/vault/readme.md', isDir: false, modified: NOW - 2 * HOUR, children: null },
];

describe('Sidebar', () => {
  beforeEach(() => {
    openVaultFile.mockReset();
    vi.mocked(invoke).mockReset();
    readVaultTree.mockResolvedValue(tree);
    onVaultChanged.mockResolvedValue(() => {});
    useAppStore.setState(initialAppState, true);
    useAppStore.setState({ vaultRoot: '/vault', sidebarExpanded: false });
    useSidebarStore.setState(initialSidebarState, true);
    useSidebarStore.setState({ tree, expanded: new Set(), cursorPath: null, draft: null });
    useSettingsStore.setState(initialSettingsState, true);
    useSettingsStore.setState({ settings: SETTINGS, diagnostics: [] });
    useFileFinderStore.getState().hide();
  });

  afterEach(() => {
    cleanup();
    // Module-level, so a pending hover-intent timer outlives its own test and would otherwise
    // open under the next one's fake clock.
    resetTooltip();
    useAppStore.setState(initialAppState, true);
    useSidebarStore.setState(initialSidebarState, true);
    useSettingsStore.setState(initialSettingsState, true);
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
    expect(screen.getByText('2 notes')).toBeInTheDocument();
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

  it('renders the four primary nav rows in order', () => {
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });

    expect(
      within(nav)
        .getAllByRole('button')
        .map((row) => row.getAttribute('aria-label'))
    ).toEqual(['New note', 'Daily note', 'New folder', 'Agent']);
  });

  // The row dispatches `global.daily-note` through the real `executeAppCommand`, which falls to its
  // `default: break` on this branch — the command is *declared* (so it resolves a chord, invariant
  // 35) but not yet *dispatched*; #151 adds its case. So there is no positive effect to assert
  // here, and mocking the dispatcher to watch the call would mock an internal rather than an I/O
  // boundary (`.agents/rules/testing.md`). What is assertable is that the row is inert rather than
  // wired to the wrong verb: it must not do what either create row beside it does.
  it('leaves the daily note row inert until the command gains a case', async () => {
    const user = userEvent.setup();
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'Daily note' }));

    expect(useSidebarStore.getState().draft).toBeNull();
    expect(useFileFinderStore.getState().open).toBe(false);
    expect(openVaultFile).not.toHaveBeenCalled();
  });

  it("renders the daily note row's chord from the global layer it is bound in", () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.daily-note': ['ctrl-w j'] }) });
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Daily note' })).toHaveTextContent('Ctrl+wj');
  });

  it('says the empty tree is empty rather than showing nothing under NOTES', async () => {
    readVaultTree.mockResolvedValue([]);
    useSidebarStore.setState({ tree: [] });
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('never renders the empty line as a row the cursor could land on', async () => {
    readVaultTree.mockResolvedValue([]);
    useSidebarStore.setState({ tree: [] });
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);
    await screen.findByText('Nothing here yet.');

    expect(within(screen.getByRole('tree')).queryAllByRole('treeitem')).toHaveLength(0);
  });

  it('drops the empty line as soon as the vault holds a note', () => {
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument();
  });

  it('drops the empty line while the first note is being named', async () => {
    readVaultTree.mockResolvedValue([]);
    useSidebarStore.setState({ tree: [] });
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);
    await screen.findByText('Nothing here yet.');

    await userEvent.setup().click(screen.getByRole('button', { name: 'New note' }));

    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New note name' })).toBeInTheDocument();
  });

  it('writes the opposite theme through the same store the settings dialog writes through', async () => {
    const user = userEvent.setup();
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(useSettingsStore.getState().settings?.theme).toBe('light');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_settings', { settings: { ...SETTINGS, theme: 'light' } });
  });

  // The icon is `aria-hidden` by design (it duplicates nothing the label says), so its identity is
  // only reachable through the class Lucide stamps on the rendered `svg` — the same handle
  // `Icon.test.tsx` and `FileTreeItem.test.tsx` already assert purely-visual affordances through.
  it('states the current theme rather than the destination', () => {
    useAppStore.getState().expandSidebar();
    const { rerender } = render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Toggle theme' }).querySelector('svg')).toHaveClass('lucide-sun');

    act(() => useSettingsStore.setState({ settings: { ...SETTINGS, theme: 'light' } }));
    rerender(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Toggle theme' }).querySelector('svg')).toHaveClass('lucide-moon');
  });

  it('states no theme at all before the boot-time load resolves', () => {
    useSettingsStore.setState({ settings: null });
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);
    const toggle = screen.getByRole('button', { name: 'Toggle theme' });

    // Mounted and disabled, but stating nothing — `Sun` here would assert the dark theme, wrongly
    // for anyone whose persisted theme is light.
    expect(toggle).toBeDisabled();
    expect(toggle.querySelector('svg')).toBeNull();
  });

  it('keeps the rail pin stating nothing before settings load too, since both are one component', () => {
    useSettingsStore.setState({ settings: null });
    render(<Sidebar />);
    const pin = screen.getByRole('button', { name: 'Toggle theme' });

    expect(pin).toBeDisabled();
    expect(pin.querySelector('svg')).toBeNull();
  });

  it('disables the theme toggle while settings.toml has a syntax error', () => {
    useSettingsStore.setState({ diagnostics: [{ kind: 'syntax', message: 'expected `=`', line: 3 }] });
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeDisabled();
  });

  it('gives the footer the theme toggle and the brand row Settings', () => {
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);
    const footer = screen.getByText('2 notes').closest('footer') as HTMLElement;

    expect(within(footer).getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    expect(within(footer).queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('mirrors both controls onto the rail while collapsed', () => {
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
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

  it('gives every note row an edited time and every folder row a recursive note count', () => {
    useAppStore.getState().expandSidebar();
    useSidebarStore.setState({ expanded: new Set(['/vault/notes', '/vault/notes/engineering']) });
    render(<Sidebar />);
    const [notes, engineering, rust, readme] = within(screen.getByRole('tree')).getAllByRole('treeitem');

    // `notes` holds no note directly, so `children.length` would read 1 for the wrong reason.
    // The recursive measure is what makes a folder of note-filled folders read non-zero.
    expect(within(notes).getByText('1')).toBeInTheDocument();
    expect(within(engineering).getByText('1')).toBeInTheDocument();
    expect(within(rust).getByText('edited 3m')).toBeInTheDocument();
    expect(within(readme).getByText('edited 2h')).toBeInTheDocument();
  });

  it('counts folders at depth, not only at the top level', () => {
    useAppStore.getState().expandSidebar();
    useSidebarStore.setState({ expanded: new Set(['/vault/notes', '/vault/notes/engineering']) });
    render(<Sidebar />);
    const engineering = within(screen.getByRole('tree')).getAllByRole('treeitem')[1];

    expect(engineering).toHaveAttribute('aria-expanded');
    expect(within(engineering).getByText('1')).toBeInTheDocument();
  });

  it('gives a folder row no edited time, since a count is what a folder carries', () => {
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);
    const notes = within(screen.getByRole('tree')).getAllByRole('treeitem')[0];

    expect(within(notes).queryByText(/^edited/)).not.toBeInTheDocument();
  });

  it('names a new entry without inventing an edit time for it', async () => {
    // The blank second line that keeps this row the same height as a note row is a CSS fact
    // jsdom cannot see; what is assertable is that the row states no edit time it does not have.
    const user = userEvent.setup();
    useAppStore.getState().expandSidebar();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'New note' }));
    const draftRow = screen.getByRole('textbox', { name: 'New note name' }).closest('[role="treeitem"]');

    expect(draftRow).not.toBeNull();
    expect(within(draftRow as HTMLElement).queryByText(/^edited/)).not.toBeInTheDocument();
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
