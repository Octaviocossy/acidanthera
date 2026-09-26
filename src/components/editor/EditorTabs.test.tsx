import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RAIL_WIDTH, SIDEBAR_DEFAULT_WIDTH, sidebarRenderedWidth } from '@/lib/layout/panel-widths';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { EditorTabs } from './EditorTabs';

const buffers = [
  {
    id: 'one',
    filePath: '/vault/one.md',
    title: 'one.md',
    content: '',
    dirty: false,
    revision: 0,
    savedRevision: 0,
    vimMode: 'normal' as const,
    view: 'read' as const,
    source: 'vault' as const,
  },
  {
    id: 'two',
    filePath: '/vault/two.md',
    title: 'two.md',
    content: '',
    dirty: true,
    revision: 1,
    savedRevision: 0,
    vimMode: 'normal' as const,
    view: 'read' as const,
    source: 'vault' as const,
  },
];

const initialAppState = useAppStore.getState();

describe('EditorTabs', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState(initialAppState, true);
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
    sidebarRenderedWidth.jump(SIDEBAR_DEFAULT_WIDTH);
  });

  it('exposes the active and dirty buffers through tab semantics', () => {
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'one.md' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'two.md, unsaved changes' })).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps the close control on an inactive tab, so the dirty dot and the close affordance coexist', () => {
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);

    // 'two' is dirty and inactive: it carries its file icon like every other tab and reveals
    // its `×` on hover, but the control stays in the tree throughout so the tab's width never
    // shifts under the pointer. The icon itself is `aria-hidden` and has no accessible name, so
    // there is nothing here to assert it by that is not a class or a DOM-shape probe.
    expect(screen.getByRole('button', { name: 'Close two.md' })).toHaveClass('opacity-0', 'group-hover:opacity-100');
    expect(screen.getByRole('button', { name: 'Close one.md' })).not.toHaveClass('opacity-0');
  });

  it('detaches the active tab as a chip instead of fusing it into the canvas below', () => {
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);

    const activeChip = screen.getByRole('tab', { name: 'one.md' }).parentElement;
    expect(activeChip).toHaveClass('rounded-tab', 'bg-canvas');
    expect(screen.getByRole('tablist')).not.toHaveClass('border-b');
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

    expect(screen.getByRole('tablist').parentElement).toHaveAttribute('data-tauri-drag-region', 'deep');
    expect(screen.getByRole('tab', { name: 'one.md' })).not.toHaveAttribute('data-tauri-drag-region');
  });

  it('keeps the view toggle out of the scrolling tab list', () => {
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
    act(() => useEditorStore.getState().openFile('/vault/one.md', '# One'));
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);

    // Inside the `overflow-x-auto` tablist it would scroll out of reach once enough tabs are open;
    // it lives in the strip's `shrink-0` sibling instead.
    const toggle = screen.getByRole('button', { name: 'Read view' });
    expect(screen.getByRole('tablist')).not.toContainElement(toggle);
    expect(screen.getByRole('tablist').parentElement).toContainElement(toggle);
  });

  it('leaves the strip uninset while the sidebar renders at full width', () => {
    sidebarRenderedWidth.jump(SIDEBAR_DEFAULT_WIDTH);
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('tablist').parentElement).toHaveStyle({ paddingLeft: '0px' });
  });

  it('insets the strip by what the rail leaves of the traffic-light clearance', () => {
    sidebarRenderedWidth.jump(RAIL_WIDTH);
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);
    // 87px of measured clearance, minus the 40px rail the lights already sit on.
    expect(screen.getByRole('tablist').parentElement).toHaveStyle({ paddingLeft: '47px' });
  });

  it('derives the inset from the rendered width mid-tween, not from the expanded flag', () => {
    useAppStore.setState({ sidebarExpanded: false });
    sidebarRenderedWidth.jump(60);
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('tablist').parentElement).toHaveStyle({ paddingLeft: '27px' });
  });

  it('follows the rendered width as it changes after mount', async () => {
    sidebarRenderedWidth.jump(SIDEBAR_DEFAULT_WIDTH);
    render(<EditorTabs buffers={buffers} activeBufferId="one" onActivate={vi.fn()} onClose={vi.fn()} />);
    act(() => sidebarRenderedWidth.jump(RAIL_WIDTH));
    await waitFor(() => expect(screen.getByRole('tablist').parentElement).toHaveStyle({ paddingLeft: '47px' }));
  });
});
