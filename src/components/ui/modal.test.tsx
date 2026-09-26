import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AnimatePresence } from 'motion/react';
import { type ReactNode, useId } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasModalOverlay, topModalOverlay } from '@/lib/keymap/modal-overlay';
import { Modal } from './modal';

describe('Modal', () => {
  afterEach(cleanup);

  it('renders its title, body, footer note, and actions', () => {
    render(<TestModal>body</TestModal>);

    expect(screen.getByRole('dialog', { name: 'Test modal' })).toHaveTextContent('body');
    expect(screen.getByText('note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('registers its overlay, focuses the panel, and disposes on unmount', () => {
    const onCancel = vi.fn();
    const { unmount } = render(<TestModal onCancel={onCancel} />);

    expect(hasModalOverlay()).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Test modal' })).toHaveFocus();
    topModalOverlay()?.onCancel();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(() => topModalOverlay()?.onConfirm?.()).not.toThrow();

    unmount();
    expect(hasModalOverlay()).toBe(false);
  });

  it('pops its overlay, goes inert and releases focus the moment its exit phase begins', async () => {
    const { rerender } = render(<PresentModal open={true} />);
    const dialog = screen.getByRole('dialog', { name: 'Test modal' });
    expect(dialog).toHaveFocus();

    rerender(<PresentModal open={false} />);

    // Same act() as the close: still on screen, already inert (invariant 60).
    expect(screen.getByRole('dialog', { name: 'Test modal' })).toBe(dialog);
    expect(hasModalOverlay()).toBe(false);
    expect(dialog.closest('[role="presentation"]')).toHaveAttribute('inert');
    expect(document.activeElement).toBe(document.body);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('pushes its overlay again and refocuses its panel when it re-enters during its exit phase', () => {
    const { rerender } = render(<PresentModal open={true} />);
    rerender(<PresentModal open={false} />);
    rerender(<PresentModal open={true} />);

    const dialog = screen.getByRole('dialog', { name: 'Test modal' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(hasModalOverlay()).toBe(true);
    expect(dialog).toHaveFocus();
    expect(dialog.closest('[role="presentation"]')).not.toHaveAttribute('inert');
  });
});

function TestModal({ children, onCancel = () => {} }: { children?: ReactNode; onCancel?: () => void }) {
  const id = useId();
  return (
    <Modal id={id} title="Test modal" note="note" actions={<button type="button">Action</button>} onCancel={onCancel} width={420}>
      {children}
    </Modal>
  );
}

function PresentModal({ open }: { open: boolean }) {
  return <AnimatePresence>{open && <TestModal />}</AnimatePresence>;
}
