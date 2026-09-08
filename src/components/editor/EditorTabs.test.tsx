import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { EditorTabs } from './EditorTabs';

const buffers = [
  { id: 'one', filePath: '/vault/one.md', title: 'one.md', content: '', dirty: false, revision: 0, savedRevision: 0, vimMode: 'normal' as const, source: 'vault' as const },
  { id: 'two', filePath: '/vault/two.md', title: 'two.md', content: '', dirty: true, revision: 1, savedRevision: 0, vimMode: 'normal' as const, source: 'vault' as const },
];

const initialAppState = useAppStore.getState();

describe('EditorTabs', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState(initialAppState, true);
  });

  it('exposes the active and dirty buffers through tab semantics', () => {
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'one.md' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'two.md, unsaved changes' })).toHaveAttribute('aria-selected', 'false');
  });

  it('activates and closes the targeted buffer', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onClose = vi.fn();
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={onActivate} onClose={onClose} />);

    await user.click(screen.getByRole('tab', { name: 'two.md, unsaved changes' }));
    await user.click(screen.getByRole('button', { name: 'Close two.md' }));

    expect(onActivate).toHaveBeenCalledWith('two');
    expect(onClose).toHaveBeenCalledWith('two');
  });

  it('still reserves the chrome strip without open buffers, so the editor never slides under the traffic lights', () => {
    render(<EditorTabs buffers={[]} activeBufferId={null} onActivate={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('marks the strip as a window drag region without putting the attribute on a tab', () => {
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('tablist')).toHaveAttribute('data-tauri-drag-region', 'deep');
    expect(screen.getByRole('tab', { name: 'one.md' })).not.toHaveAttribute('data-tauri-drag-region');
  });

  it('insets the strip past the traffic lights only while the sidebar is collapsed', () => {
    useAppStore.setState({ sidebarExpanded: true });
    const { rerender } = render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('tablist')).toHaveStyle({ paddingLeft: '0px' });

    act(() => {
      useAppStore.setState({ sidebarExpanded: false });
    });
    rerender(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);

    // 76px of clearance, minus the 40px rail the lights already sit on.
    expect(screen.getByRole('tablist')).toHaveStyle({ paddingLeft: '36px' });
  });
});
