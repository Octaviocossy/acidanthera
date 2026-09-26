import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from './toast-store';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    useToastStore.setState({ toasts: [] });
  });

  it('shows an info toast by default', () => {
    useToastStore.getState().showToast('Saved note.md');

    expect(useToastStore.getState().toasts).toEqual([{ id: expect.any(Number), message: 'Saved note.md', tone: 'info' }]);
  });

  it('dismisses an info toast after two seconds', () => {
    useToastStore.getState().showToast('Saved note.md');

    vi.advanceTimersByTime(1999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('keeps an error toast for six seconds', () => {
    useToastStore.getState().showToast('Save failed', 'error');

    vi.advanceTimersByTime(5999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removes a dismissed toast at once, with no leaving phase', () => {
    useToastStore.getState().showToast('Saved note.md');
    const [toast] = useToastStore.getState().toasts;

    useToastStore.getState().dismissToast(toast.id);

    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('ignores a second dismissal of the same toast', () => {
    useToastStore.getState().showToast('Saved note.md');
    const [toast] = useToastStore.getState().toasts;
    useToastStore.getState().dismissToast(toast.id);
    const after = useToastStore.getState().toasts;

    useToastStore.getState().dismissToast(toast.id);

    expect(useToastStore.getState().toasts).toBe(after);
  });
});
