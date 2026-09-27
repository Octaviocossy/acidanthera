import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useToastStore } from '@/stores/toast-store';
import { ToastHost } from './ToastHost';

/** Invariant 60: in the same act as the close, a closed overlay is gone or already inert. */
function expectGoneOrInert(element: HTMLElement): void {
  expect(!element.isConnected || element.closest('[inert]') !== null).toBe(true);
}

describe('ToastHost', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    cleanup();
    useToastStore.setState({ toasts: [] });
  });

  it('renders each toast as a button carrying its message, with a caps tag on an error', () => {
    useToastStore.setState({
      toasts: [
        { id: 1, message: 'Saved note.md', tone: 'info' },
        { id: 2, message: 'Save failed', tone: 'error' },
      ],
    });

    render(<ToastHost />);

    expect(screen.getByRole('button', { name: 'Saved note.md' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'errorSave failed' })).toBeInTheDocument();
  });

  it('mounts a new toast at its hidden variant, so it rises in', () => {
    render(<ToastHost />);

    act(() => useToastStore.setState({ toasts: [{ id: 1, message: 'Saved note.md', tone: 'info' }] }));

    expect(screen.getByRole('button', { name: 'Saved note.md' }).style.opacity).toBe('0');
  });

  it('removes a clicked toast from the store at once and leaves it inert through its exit phase', async () => {
    useToastStore.setState({ toasts: [{ id: 1, message: 'Saved note.md', tone: 'info' }] });
    render(<ToastHost />);
    const toast = screen.getByRole('button', { name: 'Saved note.md' });

    fireEvent.click(toast);

    expect(useToastStore.getState().toasts).toEqual([]);
    expectGoneOrInert(toast);
    await waitFor(() => expect(toast).not.toBeInTheDocument());
  });

  it('keeps the other toasts interactive while one leaves', () => {
    useToastStore.setState({
      toasts: [
        { id: 1, message: 'Saved a.md', tone: 'info' },
        { id: 2, message: 'Saved b.md', tone: 'info' },
      ],
    });
    render(<ToastHost />);

    fireEvent.click(screen.getByRole('button', { name: 'Saved a.md' }));

    expect(screen.getByRole('button', { name: 'Saved b.md' })).not.toHaveAttribute('inert');
  });

  it('paints the stack above every scrim', () => {
    const { container } = render(<ToastHost />);

    expect(container.firstElementChild).toHaveClass('z-30');
  });
});
