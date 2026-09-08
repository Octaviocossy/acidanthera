import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { Titlebar } from './Titlebar';

describe('Titlebar', () => {
  beforeEach(() => {
    useAppStore.setState({ vaultRoot: null, settingsOpen: false, agentOpen: false });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ vaultRoot: null, settingsOpen: false, agentOpen: false });
  });

  it('renders the open vault name', () => {
    useAppStore.setState({ vaultRoot: '/Users/x/Documents/acidanthera-brain' });

    render(<Titlebar />);

    expect(screen.getByText('acidanthera-brain')).toBeInTheDocument();
  });

  it('renders acidanthera without a separator when no vault is open', () => {
    useAppStore.setState({ vaultRoot: null });

    render(<Titlebar />);

    expect(screen.getByText('acidanthera')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('carries the agent toggle and settings, and nothing the sidebar rail owns', () => {
    render(<Titlebar />);

    expect(screen.queryByRole('button', { name: 'Show sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Find file' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open AI agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('toggles the agent panel and reflects it in aria-pressed', async () => {
    const user = userEvent.setup();
    render(<Titlebar />);
    const toggle = screen.getByRole('button', { name: 'Open AI agent' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(useAppStore.getState().agentOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Close AI agent' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('closes an open agent panel', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ agentOpen: true });
    render(<Titlebar />);

    await user.click(screen.getByRole('button', { name: 'Close AI agent' }));

    expect(useAppStore.getState().agentOpen).toBe(false);
  });

  it('marks the whole titlebar as a window drag region', () => {
    render(<Titlebar />);

    expect(screen.getByRole('banner')).toHaveAttribute('data-tauri-drag-region', 'deep');
  });
});
