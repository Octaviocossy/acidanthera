import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorTabs } from './EditorTabs';

const buffers = [
  { id: 'one', filePath: '/vault/one.md', title: 'one.md', content: '', dirty: false, revision: 0, savedRevision: 0, vimMode: 'normal' as const },
  { id: 'two', filePath: '/vault/two.md', title: 'two.md', content: '', dirty: true, revision: 1, savedRevision: 0, vimMode: 'normal' as const },
];

describe('EditorTabs', () => {
  afterEach(cleanup);

  it('exposes the active buffer through tab semantics', () => {
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
});
