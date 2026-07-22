import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloseBufferDialog } from './CloseBufferDialog';

const savedBuffer = { id: 'one', filePath: '/vault/one.md', title: 'one.md', content: '', dirty: true, revision: 1, savedRevision: 0, vimMode: 'normal' as const };
const scratchBuffer = { ...savedBuffer, id: 'scratch-one', filePath: null, title: 'Untitled' };

describe('CloseBufferDialog', () => {
  afterEach(cleanup);

  it('offers Save, Discard, and Cancel for a dirty saved buffer', () => {
    render(<CloseBufferDialog buffer={savedBuffer} onSave={vi.fn().mockResolvedValue(true)} onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not offer Save for a dirty scratch buffer', () => {
    render(<CloseBufferDialog buffer={scratchBuffer} onSave={vi.fn().mockResolvedValue(false)} onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('discards when requested', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(<CloseBufferDialog buffer={scratchBuffer} onSave={vi.fn().mockResolvedValue(false)} onDiscard={onDiscard} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
