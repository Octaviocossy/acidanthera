import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Segmented } from './segmented';

describe('Segmented', () => {
  afterEach(cleanup);

  it('exposes and changes the selected option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={['dark', 'light']} value="dark" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'light' }));

    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('marks the active option without the ember accent', () => {
    render(<Segmented options={['dark', 'light']} value="dark" onChange={vi.fn()} />);

    // The accent asserts AI agency (invariant 21), which neither of this primitive's consumers —
    // the theme row or the *view toggle* — is. The active state is a surface step, not a colour.
    // The selected semantics are already asserted through `aria-pressed` in the test above; only
    // the negative colour claim needs a class handle, having no behavioral equivalent.
    expect(screen.getByRole('button', { name: 'dark' }).className).not.toMatch(/accent/);
  });
});
