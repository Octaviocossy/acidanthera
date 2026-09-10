import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatChord } from '@/lib/keymap/format-chord';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { HomeSurface } from './HomeSurface';

const { pickAndPersistVault } = vi.hoisted(() => ({ pickAndPersistVault: vi.fn() }));
vi.mock('@/lib/vault/pick-vault', () => ({ pickAndPersistVault }));

// A row's own behavior ends at the dispatch: what each command then does lives in — and is tested
// with — `executeAppCommand` and `startNoteDraft`. Spread the real module so `APP_COMMANDS` still
// backs `resolveKeymap`; only the dispatcher is replaced.
const { executeAppCommand } = vi.hoisted(() => ({ executeAppCommand: vi.fn() }));
vi.mock('@/lib/app-command', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/app-command')>()), executeAppCommand }));

const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();
const initialChatState = useChatStore.getState();
const note = { name: 'note.md', path: '/vault/note.md', isDir: false, modified: null, children: null };

const dock = () => screen.queryByLabelText('Chat input');

describe('HomeSurface', () => {
  afterEach(cleanup);

  beforeEach(() => {
    executeAppCommand.mockReset();
    pickAndPersistVault.mockReset();
    pickAndPersistVault.mockResolvedValue('/picked');
    useAppStore.setState(initialAppState, true);
    useSidebarStore.setState(initialSidebarState, true);
    useChatStore.setState(initialChatState, true);
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

  it('renders no greeting for a vault that has notes, and relabels the create row without changing its command', () => {
    useSidebarStore.setState({ tree: [note] });

    render(<HomeSurface />);

    // `No note open.` only restated the surface itself; the other two states keep their greeting.
    expect(screen.queryByText('No note open.')).not.toBeInTheDocument();
    // The subtitle survives the greeting's removal — the wrapper did not go with it.
    expect(screen.getByText(/Everything stays local/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New note/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Write your first note/ })).not.toBeInTheDocument();
    // The row set does not shrink once the vault has notes — only the greeting and this label move.
    expect(screen.getByRole('button', { name: /Start today's daily note/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open an existing vault/ })).toBeInTheDocument();
  });

  it('dispatches the global create command from the create row', async () => {
    render(<HomeSurface />);
    await userEvent.click(screen.getByRole('button', { name: /Write your first note/ }));

    // The global verb, not the sidebar's `a`: this row is drawn in the viewer, so it must fire the
    // command that works from there — the same one whose chord it advertises (invariant 35). Where
    // the draft then lands, and the sidebar expansion that precedes it, belong to `startNoteDraft`
    // and are covered by `start-draft.test.ts`; this surface renders none of it.
    expect(executeAppCommand).toHaveBeenCalledWith('global.new-note');
  });

  it('dispatches the daily-note command from the daily-note row, inert though that command still is', async () => {
    render(<HomeSurface />);
    await userEvent.click(screen.getByRole('button', { name: /Start today's daily note/ }));

    // `executeAppCommand` has no case for it until #151 lands. What the row can promise today is
    // that it asks for the right command — never that a daily note appears.
    expect(executeAppCommand).toHaveBeenCalledWith('global.daily-note');
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

  describe('the agent dock', () => {
    it('offers the composer with its own cold-start invitation once a vault is open', () => {
      render(<HomeSurface />);

      expect(dock()).toHaveAttribute('placeholder', 'Or ask — "set up a structure for PKM + work notes"');
    });

    it('is absent with no vault open, where a turn could only produce an error item', () => {
      useAppStore.setState({ vaultRoot: null });

      render(<HomeSurface />);

      expect(dock()).not.toBeInTheDocument();
    });

    it('is hidden while the agent panel is open, so one transcript never has two composers', () => {
      useAppStore.setState({ agentOpen: true });

      render(<HomeSurface />);

      expect(dock()).not.toBeInTheDocument();
    });

    // The order is the whole point of `submitFromDock`, not an incidental consequence of it:
    // `sendMessage` never reads `agentOpen`, so sending first would stream a real turn's events into
    // an unmounted transcript (ADR 0038, invariant 34). Asserting both ran would not catch that.
    it('opens the panel before it sends, never after', async () => {
      const calls: string[] = [];
      useAppStore.setState({ openAgent: () => void calls.push('openAgent') });
      useChatStore.setState({ sendMessage: async () => void calls.push('sendMessage') });
      render(<HomeSurface />);

      await userEvent.type(dock() as HTMLElement, 'plan my week{Enter}');

      expect(calls).toEqual(['openAgent', 'sendMessage']);
    });

    it('sends the typed turn itself, trimmed', async () => {
      const sendMessage = vi.fn(async () => {});
      useAppStore.setState({ openAgent: vi.fn() });
      useChatStore.setState({ sendMessage });
      render(<HomeSurface />);

      await userEvent.type(dock() as HTMLElement, '  plan my week  {Enter}');

      expect(sendMessage).toHaveBeenCalledWith('plan my week');
    });

    it('takes DOM focus while the viewer region is active, and releases it when the region moves away', () => {
      render(<HomeSurface />);
      const input = dock();

      // The dock is the only focusable thing in the card, so invariant 20's "region focus implies
      // DOM focus" lands here rather than on a `BufferEditor` that is not mounted.
      expect(input).toHaveFocus();

      act(() => useAppStore.setState({ activeRegion: 'sidebar' }));

      // Left focused, the sidebar's `j`/`k` would be typed into the composer instead of moving its
      // cursor — the other half of the same invariant.
      expect(input).not.toHaveFocus();
    });

    // `isEditableTarget` is true for an `INPUT`, so the window dispatcher bails on the dock exactly
    // as it bails on the editor's `contenteditable`. Without the escape hatch `regionExit` gives the
    // editor, focusing the dock above would leave every global chord dead in the app's default boot
    // state — including the one the row directly above the dock advertises (invariant 35).
    it('still answers a global chord typed into it, rather than swallowing the keystrokes', async () => {
      render(<HomeSurface />);
      expect(dock()).toHaveFocus();

      await userEvent.keyboard('{Control>}w{/Control}n');

      expect(executeAppCommand).toHaveBeenCalledWith('global.new-note');
      // Neither half of the chord may reach the field it was typed into.
      expect(dock()).toHaveValue('');
    });

    it('reads that chord from the resolved keymap, so a rebind reaches the dock too', async () => {
      useKeymapStore.setState({ resolved: resolveKeymap({ 'global.new-note': ['ctrl-w y'] }) });
      render(<HomeSurface />);

      await userEvent.keyboard('{Control>}w{/Control}y');

      expect(executeAppCommand).toHaveBeenCalledWith('global.new-note');
    });
  });
});
