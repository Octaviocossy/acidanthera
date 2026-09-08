import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const { KeymapsSettings } = await import('./KeymapsSettings');
const { resolveKeymap } = await import('@/lib/keymap/resolve');
const { useAppStore } = await import('@/stores/app-store');
const { useEditorStore } = await import('@/stores/editor-store');
const { useKeymapStore } = await import('@/stores/keymap-store');

describe('KeymapsSettings', () => {
  afterEach(cleanup);

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue('');
    useKeymapStore.setState({ resolved: resolveKeymap(null) });
    useAppStore.setState({ settingsOpen: true });
    useEditorStore.setState({ buffers: [], activeBufferId: null });
  });

  it('renders every section in the documented order', () => {
    render(<KeymapsSettings />);

    for (const heading of ['Global', 'Sidebar', 'Chat history', 'Editor', 'Dialogs']) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it('renders a command label, its dotted id, and its chord', () => {
    render(<KeymapsSettings />);

    expect(screen.getByText('Find file')).toBeInTheDocument();
    expect(screen.getByText('global.find-file')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+wf')).toBeInTheDocument();
  });

  it('renders every chord of a command bound to more than one', () => {
    render(<KeymapsSettings />);

    // Scoped to the row: `l` and `⏎` are each bound in more than one layer.
    const row = screen.getByText('sidebar.open').closest('div')?.parentElement;
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('l')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('⏎')).toBeInTheDocument();
  });

  it('shows the displaced default beside a rebound command', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.find-file': ['ctrl-p'] }) });

    render(<KeymapsSettings />);

    expect(screen.getByText('Ctrl+p')).toBeInTheDocument();
    expect(screen.getByText('was Ctrl+wf')).toBeInTheDocument();
  });

  it('marks an unbound command with an em-dash and the default it lost', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'global.toggle-chat': [] }) });

    render(<KeymapsSettings />);

    expect(screen.getByText('unbound (was Ctrl+wc)')).toBeInTheDocument();
  });

  it('renders the keymap diagnostics when the merge degraded something', () => {
    useKeymapStore.setState({ resolved: resolveKeymap({ 'nope.not-a-command': ['x'] }) });

    render(<KeymapsSettings />);

    expect(screen.getByText(/Unknown command id "nope.not-a-command"/)).toBeInTheDocument();
  });

  it('renders no diagnostics block when the keymap resolved cleanly', () => {
    render(<KeymapsSettings />);

    expect(screen.queryByText('keymaps.toml fell back')).not.toBeInTheDocument();
  });

  it('closes the dialog before opening keymaps.toml, so the editor can claim focus', async () => {
    render(<KeymapsSettings />);

    await userEvent.click(screen.getByRole('button', { name: 'Edit keymaps.toml' }));

    expect(useAppStore.getState().settingsOpen).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('read_config_file', { name: 'keymaps.toml' });
  });
});
