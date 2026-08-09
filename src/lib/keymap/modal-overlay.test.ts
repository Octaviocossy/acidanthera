import { describe, expect, it, vi } from 'vitest';
import { hasModalOverlay, type ModalOverlay, pushModalOverlay, topModalOverlay } from './modal-overlay';

function overlay(id: string): ModalOverlay {
  return { id, onCancel: vi.fn() };
}

describe('modal overlay registry', () => {
  it('keeps the most recently pushed overlay on top', () => {
    const first = overlay('first');
    const second = overlay('second');
    const disposeFirst = pushModalOverlay(first);
    const disposeSecond = pushModalOverlay(second);

    expect(topModalOverlay()).toBe(second);

    disposeSecond();
    expect(topModalOverlay()).toBe(first);
    disposeFirst();
  });

  it('tracks whether any overlay is open', () => {
    const dispose = pushModalOverlay(overlay('only'));

    expect(hasModalOverlay()).toBe(true);

    dispose();
    expect(hasModalOverlay()).toBe(false);
  });

  it('removes an overlay by identity when disposed out of order', () => {
    const first = overlay('first');
    const second = overlay('second');
    const disposeFirst = pushModalOverlay(first);
    const disposeSecond = pushModalOverlay(second);

    disposeFirst();

    expect(topModalOverlay()).toBe(second);
    expect(hasModalOverlay()).toBe(true);

    disposeSecond();
    expect(topModalOverlay()).toBeNull();
  });
});
