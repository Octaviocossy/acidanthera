import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Kbd } from './kbd';

describe('Kbd', () => {
  it('renders a boxed keyboard hint by default', () => {
    render(<Kbd>esc</Kbd>);

    expect(screen.getByText('esc')).toHaveClass('border', 'rounded-kbd');
  });

  it('renders a bare keyboard hint when requested', () => {
    render(<Kbd boxed={false}>⌘⏎</Kbd>);

    expect(screen.getByText('⌘⏎')).not.toHaveClass('border');
  });
});
