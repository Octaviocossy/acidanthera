import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hideTooltip, requestTooltip, resetTooltip, type TooltipPlacement } from '@/lib/tooltip/tooltip-overlay';
import { TooltipHost } from './TooltipHost';

const OPEN_DELAY_MS = 500;

function open(content: string, placement: TooltipPlacement = 'right'): void {
  requestTooltip({ content, rect: document.createElement('div').getBoundingClientRect(), placement });
}

function openCold(content: string): HTMLElement {
  act(() => {
    open(content);
    vi.advanceTimersByTime(OPEN_DELAY_MS);
  });
  return screen.getByRole('tooltip');
}

describe('TooltipHost', () => {
  beforeEach(() => {
    // Fake only the open delay and the warm window's clock. Motion's frames run on
    // requestAnimationFrame, and full fake timers freeze jsdom's frame interval for the whole file.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    cleanup();
    resetTooltip();
    vi.useRealTimers();
  });

  it('mounts a cold open at its hidden variant, positioned before it enters', () => {
    render(<TooltipHost />);

    const panel = openCold('notes');

    expect(panel).not.toHaveStyle({ visibility: 'hidden' });
    expect(panel.style.opacity).toBe('0');
  });

  it('hands a warm open off in place: one panel, the same node, the new content', () => {
    render(<TooltipHost />);
    const panel = openCold('notes');

    act(() => hideTooltip());
    act(() => open('readme.md'));

    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toBe(panel);
    expect(panel).toHaveTextContent('readme.md');
  });

  it('keeps a panel nothing takes over mounted through its exit phase, then removes it', async () => {
    render(<TooltipHost />);
    const panel = openCold('notes');

    // Motion's exit completion is driven by real animation frames; the fake `Date` this file
    // uses for the open delay would otherwise freeze Motion's own clock mid-exit.
    vi.useRealTimers();
    act(() => hideTooltip());

    expect(panel).toBeInTheDocument();
    await waitFor(() => expect(panel).not.toBeInTheDocument());
  });

  it.each(['keydown', 'mousedown', 'blur', 'scroll'])('drops the panel at once on a %s dismissal, with no exit phase', (type) => {
    render(<TooltipHost />);
    openCold('notes');

    act(() => {
      window.dispatchEvent(new Event(type));
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
