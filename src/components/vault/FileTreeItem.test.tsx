import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FileTreeItem } from './FileTreeItem';

const MINUTE = 60_000;

afterEach(cleanup);

describe('FileTreeItem', () => {
  it('gives a note a second line carrying its edited time', () => {
    render(<FileTreeItem label="readme.md" kind="file" depth={0} modified={Date.now() - 3 * MINUTE} />);

    expect(screen.getByText('readme.md')).toBeInTheDocument();
    expect(screen.getByText('edited 3m')).toBeInTheDocument();
  });

  it('shows a note whose mtime could not be read as a title alone, with no placeholder', () => {
    render(<FileTreeItem label="readme.md" kind="file" depth={0} modified={null} />);

    expect(screen.getByText('readme.md')).toBeInTheDocument();
    expect(screen.queryByText(/^edited/)).not.toBeInTheDocument();
  });

  it('gives a directory a recursive note count and no edited time', () => {
    render(<FileTreeItem label="engineering" kind="dir" depth={0} noteCount={4} />);

    expect(screen.getByText('engineering')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText(/^edited/)).not.toBeInTheDocument();
  });

  it('lifts a folder label out of muted while the cursor rests on it', () => {
    // A folder is a subdued group header at rest, but the cursor has to read on it exactly as it
    // does on a note — otherwise only the row background moves and the folder text stays muted.
    const { rerender } = render(<FileTreeItem label="engineering" kind="dir" depth={0} noteCount={4} />);
    expect(screen.getByText('engineering')).toHaveClass('text-text-muted');

    rerender(<FileTreeItem label="engineering" kind="dir" depth={0} noteCount={4} cursor />);

    expect(screen.getByText('engineering')).not.toHaveClass('text-text-muted');
  });

  it('counts a directory the same way at every depth, not just the top level', () => {
    render(<FileTreeItem label="2026" kind="dir" depth={3} noteCount={7} />);

    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('still marks an open buffer with unsaved changes', () => {
    const { container } = render(<FileTreeItem label="readme.md" kind="file" depth={0} modified={Date.now()} changed />);

    expect(container.querySelector('.bg-accent')).not.toBeNull();
  });

  it('leaves a clean note undotted', () => {
    const { container } = render(<FileTreeItem label="readme.md" kind="file" depth={0} modified={Date.now()} />);

    expect(container.querySelector('.bg-accent')).toBeNull();
  });

  it('keeps the disclosure state a directory reports to assistive technology', () => {
    render(<FileTreeItem label="engineering" kind="dir" depth={0} noteCount={0} collapsed />);

    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'false');
  });
});
