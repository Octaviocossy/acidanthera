import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipHost } from '@/components/layout/TooltipHost';
import { resetTooltip } from '@/lib/tooltip/tooltip-overlay';
import { activeEditorBuffer, useEditorStore } from '@/stores/editor-store';
import { ViewToggle } from './ViewToggle';

describe('ViewToggle', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
  });

  it('offers both views for a vault note, with the current one selected', () => {
    useEditorStore.getState().openFile('/vault/note.md', '# Note');

    render(<ViewToggle />);

    expect(screen.getByRole('button', { name: 'Read view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Edit view' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the active view with the elevated surface, and leaves the inactive one plain', () => {
    useEditorStore.getState().openFile('/vault/note.md', '# Note');

    render(<ViewToggle />);

    expect(screen.getByRole('button', { name: 'Read view' }).className).toMatch(/bg-elevated/);
    expect(screen.getByRole('button', { name: 'Edit view' }).className).not.toMatch(/bg-elevated/);
  });

  it('switches the active buffer to the chosen view', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().openFile('/vault/note.md', '# Note');
    render(<ViewToggle />);

    await user.click(screen.getByRole('button', { name: 'Edit view' }));

    expect(activeEditorBuffer(useEditorStore.getState())?.view).toBe('edit');
  });

  it('draws nothing for a config buffer — hidden, never disabled', () => {
    useEditorStore.getState().openFile('settings.toml', 'theme = "dark"', 'config');

    render(<ViewToggle />);

    // TOML has nothing to render, so the control does not apply at all (spec decision 2).
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('draws nothing with no buffer open', () => {
    render(<ViewToggle />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('stays monochrome — a view toggle asserts no AI agency', () => {
    useEditorStore.getState().openFile('/vault/note.md', '# Note');

    render(<ViewToggle />);

    // Invariants 21 and 27 leave the app two coloured fills, and neither of them is this.
    expect(screen.getByRole('button', { name: 'Read view' }).className).not.toMatch(/accent|danger/);
    expect(screen.getByRole('button', { name: 'Edit view' }).className).not.toMatch(/accent|danger/);
  });

  describe('hover reveal', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      useEditorStore.getState().openFile('/vault/note.md', '# Note');
    });

    afterEach(() => {
      resetTooltip();
      vi.useRealTimers();
    });

    it("reveals each button's label beside the live global.toggle-view chord", () => {
      render(
        <>
          <ViewToggle />
          <TooltipHost />
        </>
      );

      fireEvent.pointerOver(screen.getByRole('button', { name: 'Read view' }));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // The default binding, formatted — proves the hint reads the resolved keymap rather than
      // a literal (invariant 31).
      expect(screen.getByRole('tooltip')).toHaveTextContent('ReadCtrl+we');

      fireEvent.pointerOut(screen.getByRole('button', { name: 'Read view' }));
      fireEvent.pointerOver(screen.getByRole('button', { name: 'Edit view' }));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByRole('tooltip')).toHaveTextContent('EditCtrl+we');
    });
  });
});
