import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { Titlebar } from './Titlebar';

describe('Titlebar', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState({ vaultRoot: null });
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
});
