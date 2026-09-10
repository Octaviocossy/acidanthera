import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatChord } from '@/lib/keymap/format-chord';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useAppStore } from '@/stores/app-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { HomeSurface } from './HomeSurface';

const { pickAndPersistVault } = vi.hoisted(() => ({ pickAndPersistVault: vi.fn() }));
vi.mock('@/lib/vault/pick-vault', () => ({ pickAndPersistVault }));

const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();
const note = { name: 'note.md', path: '/vault/note.md', isDir: false, modified: null, children: null };

describe('HomeSurface', () => {
  afterEach(cleanup);

  beforeEach(() => {
    pickAndPersistVault.mockReset();
    pickAndPersistVault.mockResolvedValue('/picked');
    useAppStore.setState(initialAppState, true);
    useSidebarStore.setState(initialSidebarState, true);
    useAppStore.setState({ vaultRoot: '/vault' });
    useSidebarStore.setState({ tree: [] });
    useKeymapStore.setState({ resolved: resolveKeymap(null) });
  });

  it('offers only the open-vault row, and no subtitle, when no vault is open', () => {
    useAppStore.setState({ vaultRoot: null });

    render(<HomeSurface />);

    expect(screen.getByText('No vault open.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open an existing vault/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /note/i })).not.toBeInTheDocument();
    // There is no path to name, so the whole sentence goes rather than rendering an empty span.
    expect(screen.queryByText(/Everything stays local/)).not.toBeInTheDocument();
  });

  it('names the vault path through displayPath in an empty vault, alongside all three rows', () => {
    useAppStore.setState({ vaultRoot: '/Users/ada/Documents/brain' });

    render(<HomeSurface />);

    expect(screen.getByText('Your vault is empty.')).toBeInTheDocument();
    expect(screen.getByText('~/Documents/brain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Write your first note/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start today's daily note/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open an existing vault/ })).toBeInTheDocument();
  });

  it('greets a vault that has notes, and relabels the create row without changing its command', () => {
    useSidebarStore.setState({ tree: [note] });

    render(<HomeSurface />);

    expect(screen.getByText('No note open.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New note/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Write your first note/ })).not.toBeInTheDocument();
    // The row set does not shrink once the vault has notes — only the greeting and this label move.
    expect(screen.getByRole('button', { name: /Start today's daily note/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open an existing vault/ })).toBeInTheDocument();
  });

  it('starts a sidebar draft from the create row, expanding the sidebar first', async () => {
    useAppStore.setState({ sidebarExpanded: false, activeRegion: 'viewer' });

    render(<HomeSurface />);
    await userEvent.click(screen.getByRole('button', { name: /Write your first note/ }));

    // A draft has nowhere to render at 40px, so the row expands the sidebar before focusing it —
    // one behavior per command however it is invoked (spec decision 10).
    expect(useAppStore.getState().sidebarExpanded).toBe(true);
    expect(useAppStore.getState().activeRegion).toBe('sidebar');
    expect(useSidebarStore.getState().draft).toEqual({ kind: 'note', parentPath: '/vault' });
  });

  it('opens the folder picker from the open-vault row', async () => {
    render(<HomeSurface />);
    await userEvent.click(screen.getByRole('button', { name: /Open an existing vault/ }));

    expect(pickAndPersistVault).toHaveBeenCalledTimes(1);
  });

  it('renders both chords from the resolved keymap, so a rebind reaches them', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.new-note': ['ctrl-p'], 'global.daily-note': ['ctrl-j'] }) });

    render(<HomeSurface />);

    expect(screen.getByText('Ctrl+p')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+j')).toBeInTheDocument();
  });

  it('omits a chord hint entirely when its command is unbound', () => {
    const defaultChord = formatChord(useKeymapStore.getState().resolved.layers.global.get('global.new-note'));
    expect(defaultChord).toBeDefined();
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.new-note': [] }) });

    render(<HomeSurface />);

    expect(screen.queryByText(defaultChord as string)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Write your first note/ })).toBeInTheDocument();
  });
});
