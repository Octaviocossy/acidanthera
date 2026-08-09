import { cleanup, render, screen } from '@testing-library/react';
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
});

function TestModal({ children, onCancel = () => {} }: { children?: ReactNode; onCancel?: () => void }) {
  const id = useId();
  return (
    <Modal id={id} title="Test modal" note="note" actions={<button type="button">Action</button>} onCancel={onCancel} width={420}>
      {children}
    </Modal>
  );
}
