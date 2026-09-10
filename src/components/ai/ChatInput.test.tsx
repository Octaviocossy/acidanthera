import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  afterEach(cleanup);

  it('invites a question with the shared default placeholder', () => {
    render(<ChatInput onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Chat input')).toHaveAttribute('placeholder', 'Ask about your vault…');
  });

  it('shows a caller-supplied placeholder instead, so the dock can read as a cold start', () => {
    render(<ChatInput placeholder="Or ask — anything" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Chat input')).toHaveAttribute('placeholder', 'Or ask — anything');
  });

  it('lets the in-flight placeholder win over a custom one, since a running turn outranks the invitation', () => {
    render(<ChatInput disabled placeholder="Or ask — anything" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Chat input')).toHaveAttribute('placeholder', 'Waiting for the agent…');
  });

  // Invariant 31's point is that a rendered chord must be *true*. Chat submit is deliberately not an
  // `AppCommandId`, so this one cannot be keymap-derived — which makes the literal itself the thing
  // under test, and it has to match the key the handler below actually answers to.
  it('advertises the key that really submits', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Chat input'), 'hello');

    expect(screen.getByRole('button', { name: /Send/ })).toHaveTextContent('⏎');
    expect(screen.getByRole('button', { name: /Send/ })).not.toHaveTextContent('⌘');
  });

  it('submits the trimmed text on bare Enter and clears the field', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Chat input');

    await userEvent.type(input, '  hello  {Enter}');

    expect(onSubmit).toHaveBeenCalledWith('hello');
    expect(input).toHaveValue('');
  });
});
