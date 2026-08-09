import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>running</Badge>);
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('defaults to the muted tone border color', () => {
    render(<Badge>default</Badge>);
    expect(screen.getByText('default')).toHaveClass('border-border');
  });

  it('applies the plain tone when requested', () => {
    render(<Badge tone="plain">label</Badge>);
    expect(screen.getByText('label')).toHaveClass('text-text-secondary');
  });
});
