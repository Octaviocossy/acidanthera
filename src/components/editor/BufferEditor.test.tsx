import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { BufferEditor } from './BufferEditor';

/** Builds the buffer through the store rather than by hand so the `EditorBuffer` shape can never
 *  drift out of sync with `openFile`. */
function openBuffer(filePath: string, content = '# Note'): EditorBuffer {
  useEditorStore.getState().openFile(filePath, content);
  const buffer = useEditorStore.getState().buffers.find((candidate) => candidate.filePath === filePath);
  if (buffer === undefined) throw new Error('expected the buffer to be open');
  return buffer;
}

describe('BufferEditor', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer', editorFocusRequest: 0 });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
  });

  it('takes DOM focus when its buffer is active and the viewer is the focused region', () => {
    render(<BufferEditor buffer={openBuffer('/vault/note.md')} active hidden={false} />);

    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('does not take DOM focus while its buffer is inactive', () => {
    render(<BufferEditor buffer={openBuffer('/vault/note.md')} active={false} hidden={false} />);

    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });

  it('does not take DOM focus while its buffer is showing the read view instead', () => {
    render(<BufferEditor buffer={openBuffer('/vault/note.md')} active hidden />);

    // Both surfaces stay mounted, so without this guard the editor and the `ReadView` beside it
    // would fight over DOM focus on every toggle. `{ hidden: true }` because a hidden surface is
    // out of the accessible tree, which is the other half of what hiding it means.
    const content = screen.getByRole('textbox', { hidden: true });
    expect(content).not.toHaveFocus();
    expect(content).not.toBeVisible();
  });

  it('does not take DOM focus while another region is focused', () => {
    useAppStore.setState({ activeRegion: 'sidebar' });
    render(<BufferEditor buffer={openBuffer('/vault/note.md')} active hidden={false} />);

    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });

  it('re-takes DOM focus for a repeat request that changes nothing else', () => {
    render(<BufferEditor buffer={openBuffer('/vault/note.md')} active hidden={false} />);
    const content = screen.getByRole('textbox');
    // What the file finder's unmounting input leaves behind when the selected note is the buffer
    // that was already active: no store state changes, but DOM focus fell back to `<body>`.
    act(() => content.blur());
    expect(content).not.toHaveFocus();

    act(() => useAppStore.getState().focusEditor());

    expect(content).toHaveFocus();
  });

  it('parses GFM, so the read view beside it cannot see markdown the editor cannot', () => {
    render(<BufferEditor buffer={openBuffer('/vault/note.md', 'a ~~gone~~ b')} active hidden={false} />);

    // Strikethrough is GFM, which `markdown()` does **not** carry: its `base` defaults to bare
    // commonmark, under which this whole line is one undifferentiated run of text. Passing
    // `markdownLanguage` — the base the *markdown walker* parses with — is what makes the editor
    // tokenize it at all, so `acidantheraHighlightStyle`'s `tags.strikethrough` rule can reach it.
    // Asserted through the token the highlighter emits rather than its generated class name, which
    // is not ours to name (invariant 36).
    const struck = [...screen.getByRole('textbox').querySelectorAll('span')].map((span) => span.textContent);
    expect(struck).toContain('gone');
  });

  it('gives up DOM focus when the focused region leaves the viewer', () => {
    render(<BufferEditor buffer={openBuffer('/vault/note.md')} active hidden={false} />);

    act(() => useAppStore.getState().focusRegion('sidebar'));

    // Otherwise the window dispatcher keeps bailing on this contenteditable target and the
    // sidebar's keys land in the buffer instead.
    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });
});
