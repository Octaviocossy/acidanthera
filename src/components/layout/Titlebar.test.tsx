import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { Titlebar } from './Titlebar';

describe('Titlebar', () => {
  beforeEach(() => {
    useAppStore.setState({ vaultRoot: null, settingsOpen: false, chatOpen: false });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ vaultRoot: null, settingsOpen: false, chatOpen: false });
  });

  it('renders the open vault name', () => {
    useAppStore.setState({ vaultRoot: '/Users/x/Documents/orbit-brain' });

    render(<Titlebar />);

    expect(screen.getByText('orbit-brain')).toBeInTheDocument();
  });

  it('renders orbit without a separator when no vault is open', () => {
    useAppStore.setState({ vaultRoot: null });

    render(<Titlebar />);

    expect(screen.getByText('orbit')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('carries the chat toggle and settings, and nothing the sidebar rail owns', () => {
    render(<Titlebar />);

    expect(screen.queryByRole('button', { name: 'Show sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Find file' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open AI chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('toggles the chat and reflects it in aria-pressed', async () => {
    const user = userEvent.setup();
    render(<Titlebar />);
    const toggle = screen.getByRole('button', { name: 'Open AI chat' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(useAppStore.getState().chatOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Close AI chat' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('closes an open chat', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ chatOpen: true });
    render(<Titlebar />);

    await user.click(screen.getByRole('button', { name: 'Close AI chat' }));

    expect(useAppStore.getState().chatOpen).toBe(false);
  });

  it('marks the whole titlebar as a window drag region', () => {
    render(<Titlebar />);

    expect(screen.getByRole('banner')).toHaveAttribute('data-tauri-drag-region', 'deep');
  });
});
