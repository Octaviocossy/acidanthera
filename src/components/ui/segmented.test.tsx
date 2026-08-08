import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Segmented } from './segmented';

describe('Segmented', () => {
  it('exposes and changes the selected option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={['dark', 'light']} value="dark" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'light' }));

    expect(onChange).toHaveBeenCalledWith('light');
  });
});
