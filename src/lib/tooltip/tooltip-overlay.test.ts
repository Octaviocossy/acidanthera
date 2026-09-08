import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushModalOverlay } from '@/lib/keymap/modal-overlay';
import { getTooltip, hideTooltip, isClipped, requestTooltip, resetTooltip, subscribeTooltip } from './tooltip-overlay';

const OPEN_DELAY_MS = 500;
const WARM_WINDOW_MS = 300;

function rect(): DOMRect {
  return document.createElement('div').getBoundingClientRect();
}

function request(content: string): void {
  requestTooltip({ content, rect: rect() });
}

describe('tooltip-overlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetTooltip();
    vi.useRealTimers();
  });

  it('opens nothing before the hover-intent delay elapses', () => {
    request('notes');

    vi.advanceTimersByTime(OPEN_DELAY_MS - 1);
    expect(getTooltip()).toBeNull();
  });

  it('opens once the delay elapses and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTooltip(listener);
    request('notes');

    vi.advanceTimersByTime(OPEN_DELAY_MS);

    expect(getTooltip()?.content).toBe('notes');
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('cancels without opening when the pointer leaves before the delay', () => {
    request('notes');
    vi.advanceTimersByTime(OPEN_DELAY_MS - 1);

    hideTooltip();
    vi.advanceTimersByTime(OPEN_DELAY_MS);

    expect(getTooltip()).toBeNull();
  });

  it('does not warm the window when a pending tooltip never opened', () => {
    request('notes');
    hideTooltip();

    request('readme.md');
    expect(getTooltip()).toBeNull();

    vi.advanceTimersByTime(OPEN_DELAY_MS);
    expect(getTooltip()?.content).toBe('readme.md');
  });

  it('opens synchronously inside the warm window after a real close', () => {
    request('notes');
    vi.advanceTimersByTime(OPEN_DELAY_MS);
    hideTooltip();

    vi.advanceTimersByTime(WARM_WINDOW_MS - 1);
    request('readme.md');

    expect(getTooltip()?.content).toBe('readme.md');
  });

  it('waits the full delay again once the warm window has lapsed', () => {
    request('notes');
    vi.advanceTimersByTime(OPEN_DELAY_MS);
    hideTooltip();

    vi.advanceTimersByTime(WARM_WINDOW_MS);
    request('readme.md');

    expect(getTooltip()).toBeNull();
    vi.advanceTimersByTime(OPEN_DELAY_MS);
    expect(getTooltip()?.content).toBe('readme.md');
  });

  it('refuses to open while a modal overlay owns the pointer', () => {
    const dispose = pushModalOverlay({ id: 'test-dialog', onCancel: () => {} });

    request('notes');
    vi.advanceTimersByTime(OPEN_DELAY_MS);
    expect(getTooltip()).toBeNull();

    dispose();
  });

  it('refuses to open when a modal overlay is pushed during the delay', () => {
    request('notes');
    const dispose = pushModalOverlay({ id: 'test-dialog', onCancel: () => {} });

    vi.advanceTimersByTime(OPEN_DELAY_MS);

    expect(getTooltip()).toBeNull();
    dispose();
  });

  it('reports a label as clipped only when it overflows its box', () => {
    const element = document.createElement('span');

    expect(isClipped(element)).toBe(false);

    Object.defineProperty(element, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });
    expect(isClipped(element)).toBe(true);
  });
});
