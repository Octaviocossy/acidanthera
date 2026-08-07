import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloseBufferDialog } from './CloseBufferDialog';

const savedBuffer = {
  id: 'one',
  filePath: '/vault/one.md',
  title: 'one.md',
  content: '',
  dirty: true,
  revision: 1,
  savedRevision: 0,
  vimMode: 'normal' as const,
  source: 'vault' as const,
};
describe('CloseBufferDialog', () => {
  afterEach(cleanup);

  it('offers Save, Discard, and Cancel for a dirty saved buffer', () => {
    render(<CloseBufferDialog buffer={savedBuffer} onSave={vi.fn().mockResolvedValue(true)} onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing without a closing buffer', () => {
    render(<CloseBufferDialog buffer={null} onSave={vi.fn().mockResolvedValue(false)} onDiscard={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
