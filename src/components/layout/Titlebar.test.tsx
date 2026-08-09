import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { Titlebar } from './Titlebar';

describe('Titlebar', () => {
  beforeEach(() => {
    useAppStore.setState({ vaultRoot: null, settingsOpen: false });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ vaultRoot: null, settingsOpen: false });
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

  it('keeps settings as its only control', () => {
    render(<Titlebar />);

    expect(screen.queryByRole('button', { name: 'Show sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Find file' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('marks the whole titlebar as a window drag region', () => {
    render(<Titlebar />);

    expect(screen.getByRole('banner')).toHaveAttribute('data-tauri-drag-region', 'deep');
  });
});
