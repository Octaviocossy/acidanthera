import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Chip } from './chip';

describe('Chip', () => {
  it('prefixes context chips with the context glyph', () => {
    render(<Chip variant="context">note.md</Chip>);

    expect(screen.getByText('◈ note.md')).toBeInTheDocument();
  });

  it('prefixes add chips with the add glyph', () => {
    render(<Chip variant="add">Add context</Chip>);

    expect(screen.getByText('＋ Add context')).toBeInTheDocument();
  });
});
