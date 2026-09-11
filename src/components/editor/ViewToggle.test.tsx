import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    expect(screen.getByRole('button', { name: 'Read' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the active buffer to the chosen view', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().openFile('/vault/note.md', '# Note');
    render(<ViewToggle />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

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
    expect(screen.getByRole('button', { name: 'Read' }).className).not.toMatch(/accent|danger/);
  });
});
