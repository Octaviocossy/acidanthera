import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { NoteHeader } from './NoteHeader';

/** A fixed mtime one minute in the past, so `relativeTime` reports a stable `1m`. */
function aMinuteAgo(): number {
  return Date.now() - 61_000;
}

describe('NoteHeader', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ vaultRoot: '/vault' });
  });

  it('renders the breadcrumb, the title and the meta line', () => {
    render(<NoteHeader filePath="/vault/engineering/Repository Pattern.md" content="Prose with [[One]] and [[Two]]." modified={aMinuteAgo()} />);

    expect(screen.getByText('engineering / Repository Pattern.md')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Repository Pattern' })).toBeInTheDocument();
    expect(screen.getByText('edited 1m · 2 links · 1 min read')).toBeInTheDocument();
  });

  it('omits the edited segment when the mtime could not be read', () => {
    render(<NoteHeader filePath="/vault/Note.md" content="Prose with [[One]] and [[Two]]." modified={null} />);

    // Omitted entirely rather than placeholdered — the block states one fewer thing.
    expect(screen.getByText('2 links · 1 min read')).toBeInTheDocument();
    expect(screen.queryByText(/edited/)).not.toBeInTheDocument();
  });

  it('says `1 link` for a note with one', () => {
    render(<NoteHeader filePath="/vault/Note.md" content="Prose with [[One]]." modified={null} />);

    expect(screen.getByText('1 link · 1 min read')).toBeInTheDocument();
  });

  it('says `0 links` for a note with none', () => {
    render(<NoteHeader filePath="/vault/Note.md" content="Prose with no links at all." modified={null} />);

    expect(screen.getByText('0 links · 1 min read')).toBeInTheDocument();
  });

  it('reports read time in whole minutes of the note it is given', () => {
    render(<NoteHeader filePath="/vault/Note.md" content={'word '.repeat(450)} modified={null} />);

    expect(screen.getByText('0 links · 3 min read')).toBeInTheDocument();
  });

  it('shows the basename alone for a note at the vault root', () => {
    render(<NoteHeader filePath="/vault/Note.md" content="" modified={null} />);

    expect(screen.getByText('Note.md')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Note' })).toBeInTheDocument();
  });

  it('renders no tags row and no add-tag control', () => {
    render(<NoteHeader filePath="/vault/Note.md" content="Prose." modified={aMinuteAgo()} />);

    // Decision 22: there is no tag concept anywhere in the app, so the mockup's row was cut.
    expect(screen.queryByText(/tag/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
