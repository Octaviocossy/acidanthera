import { commonmarkLanguage, markdownLanguage } from '@codemirror/lang-markdown';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInlineText, renderMarkdown } from './markdown-walker';

const convertFileSrc = vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`);
const openUrl = vi.fn((_url: string) => Promise.resolve());

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => convertFileSrc(path) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: (url: string) => openUrl(url) }));

/** Renders a note's source the way `ReadView` does, and hands back the rendered container. */
function renderNote(source: string, vaultRoot: string | null = '/vault') {
  return render(<div>{renderMarkdown(source, { vaultRoot })}</div>).container;
}

describe('renderMarkdown', () => {
  afterEach(cleanup);

  beforeEach(() => {
    convertFileSrc.mockClear();
    openUrl.mockClear();
  });

  it('renders an ATX heading at its level, without the syntax that spelled it', () => {
    renderNote('## A section');

    expect(screen.getByRole('heading', { level: 2, name: 'A section' })).toBeInTheDocument();
  });

  it('renders a setext heading, whose only mark sits at the end', () => {
    renderNote('Underlined\n==========');

    expect(screen.getByRole('heading', { level: 1, name: 'Underlined' })).toBeInTheDocument();
  });

  it('renders inline emphasis as elements rather than as its delimiters', () => {
    const container = renderNote('Plain *em* **strong** ~~gone~~ `code`.');

    expect(container.querySelector('em')).toHaveTextContent('em');
    expect(container.querySelector('strong')).toHaveTextContent('strong');
    expect(container.querySelector('del')).toHaveTextContent('gone');
    expect(container.querySelector('code')).toHaveTextContent('code');
    expect(container.textContent).not.toContain('*');
  });

  it('renders a bullet list as list items', () => {
    renderNote('- one\n- two');

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['one', 'two']);
  });

  it('renders an ordered list, carrying a start other than 1', () => {
    const container = renderNote('3. three\n4. four');

    expect(container.querySelector('ol')).toHaveAttribute('start', '3');
  });

  it('renders a blockquote without its quote marks', () => {
    const container = renderNote('> quoted line');

    expect(container.querySelector('blockquote')).toHaveTextContent('quoted line');
    expect(container.textContent).not.toContain('>');
  });

  it('renders a thematic break as a rule', () => {
    const container = renderNote('above\n\n---\n\nbelow');

    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  it('preserves a fenced block’s text, and never shows its fence', () => {
    const container = renderNote('```js\nconst a = 1;\nconst b = 2;\n```');

    const code = container.querySelector('pre code');
    expect(code).toHaveTextContent('const a = 1;');
    expect(code?.textContent).toBe('const a = 1;\nconst b = 2;');
    expect(container.textContent).not.toContain('```');
  });

  it('preserves an indented block’s lines without their indentation', () => {
    const container = renderNote('    first\n    second');

    expect(container.querySelector('pre code')?.textContent).toBe('first\nsecond');
  });

  it('renders a GFM table as header cells and body cells', () => {
    renderNote('| a | b |\n|---|---|\n| 1 | 2 |');

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['a', 'b']);
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['1', '2']);
  });

  it('parses with the editor’s own base, so neither view can see markdown the other cannot', () => {
    // The regression this pins: the walker used to configure GFM onto the bare commonmark parser
    // while `BufferEditor` called `markdown()`, whose `base` **defaults** to commonmark — so a
    // table, a task list and `~~strikethrough~~` rendered as GFM in read and as plain text in edit,
    // the split invariant 36 exists to prevent. Both now parse with `markdownLanguage`. Asserted
    // against `commonmarkLanguage` directly rather than by rendering, so the test states the
    // difference instead of restating the table case above; `BufferEditor.test.tsx` asserts that
    // the editor is given the same base.
    const table = '| a | b |\n|---|---|\n| 1 | 2 |';
    expect(commonmarkLanguage.parser.parse(table).topNode.firstChild?.name).not.toBe('Table');
    expect(markdownLanguage.parser.parse(table).topNode.firstChild?.name).toBe('Table');
  });

  it('renders a task list as checkboxes reflecting each marker', () => {
    renderNote('- [ ] open\n- [x] done');

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([false, true]);
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('leaves task checkboxes disabled — the read view renders and does not write (invariant 37)', () => {
    renderNote('- [ ] not yet interactive');

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('renders a raw HTML block as visible text and creates no element from it', () => {
    const container = renderNote('<script>alert(1)</script>');

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });

  it('renders an inline HTML tag as visible text', () => {
    const container = renderNote('Before <img src="x" onerror="alert(1)"> after');

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src="x" onerror="alert(1)">');
  });

  it('decodes a named character reference, which is markdown text and not raw HTML', () => {
    const container = renderNote('Tom &amp; Jerry');

    expect(container.textContent).toBe('Tom & Jerry');
  });

  it('decodes a numeric character reference in both its decimal and hex forms', () => {
    const container = renderNote('&#38; and &#x26;');

    expect(container.textContent).toBe('& and &');
  });

  it('renders an unrecognized character reference as its own literal source', () => {
    const container = renderNote('&notanentity; and &#xd800;');

    expect(container.textContent).toBe('&notanentity; and &#xd800;');
  });

  it('escapes a decoded reference on output, so decoding is no relaxation of the HTML rule', () => {
    // `&lt;script&gt;` decodes to the *text* `<script>`; React escapes a string child on output, so
    // what lands in the DOM is visible text and never markup (spec decision 8).
    const container = renderNote('&lt;script&gt;alert(1)&lt;/script&gt;');

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toBe('<script>alert(1)</script>');
  });

  it('keeps a decoded reference inside its surrounding text run', () => {
    // A character reference is prose, so it must not split the run the way a rendering element
    // does: what reaches `renderInlineText` is one piece, which is what #162 matches `[[…]]` over.
    const container = renderNote('See A &amp; B here');
    const paragraph = container.querySelector('p');

    expect(paragraph?.textContent).toBe('See A & B here');
    expect(paragraph?.childNodes).toHaveLength(1);
  });

  it('renders an escaped character without its backslash', () => {
    const container = renderNote('\\*not emphasis\\*');

    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toBe('*not emphasis*');
  });

  it('renders an external link as an anchor', () => {
    renderNote('[the docs](https://example.com/docs)');

    expect(screen.getByRole('link', { name: 'the docs' })).toHaveAttribute('href', 'https://example.com/docs');
  });

  it('hands an external link to the OS browser instead of navigating the webview', async () => {
    renderNote('[the docs](https://example.com/docs)');

    await userEvent.click(screen.getByRole('link', { name: 'the docs' }));

    expect(openUrl).toHaveBeenCalledWith('https://example.com/docs');
  });

  it('renders a non-http link target as plain text, since nothing can open it', () => {
    const container = renderNote('[a file](file:///etc/passwd)');

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('a file');
  });

  it('serves a vault-local image through the asset protocol', () => {
    renderNote('![a diagram](notes/diagram.png)');

    expect(convertFileSrc).toHaveBeenCalledWith('/vault/notes/diagram.png');
    expect(screen.getByRole('img', { name: 'a diagram' })).toBeInTheDocument();
  });

  it('serves an absolute image path that is inside the vault', () => {
    renderNote('![a diagram](/vault/notes/diagram.png)');

    expect(convertFileSrc).toHaveBeenCalledWith('/vault/notes/diagram.png');
    expect(screen.getByRole('img', { name: 'a diagram' })).toBeInTheDocument();
  });

  it('renders an absolute image path outside the vault as alt text, building no URL for it', () => {
    const container = renderNote('![a secret](/etc/passwd.png)');

    expect(container.querySelector('img')).toBeNull();
    expect(convertFileSrc).not.toHaveBeenCalled();
    expect(container.textContent).toContain('a secret');
  });

  it('renders a `..` escape as alt text, so a relative target cannot climb out of the vault', () => {
    const container = renderNote('![elsewhere](../../elsewhere/x.png)');

    expect(container.querySelector('img')).toBeNull();
    expect(convertFileSrc).not.toHaveBeenCalled();
  });

  it('rejects a sibling directory sharing the vault’s name prefix', () => {
    // Containment compares on a separator boundary; a bare `startsWith` would let this through.
    const container = renderNote('![backup](/vault-backup/x.png)');

    expect(container.querySelector('img')).toBeNull();
    expect(convertFileSrc).not.toHaveBeenCalled();
  });

  it('resolves a `.`/`..` path that stays inside the vault', () => {
    renderNote('![a diagram](notes/../notes/./diagram.png)');

    expect(convertFileSrc).toHaveBeenCalledWith('/vault/notes/diagram.png');
  });

  it('renders a remote image as its alt text alone, never as an <img>', () => {
    const container = renderNote('![a remote picture](https://example.com/p.png)');

    expect(container.querySelector('img')).toBeNull();
    expect(convertFileSrc).not.toHaveBeenCalled();
    expect(container.textContent).toContain('a remote picture');
  });

  it('renders a local image as alt text while no vault is open — absolute ones included', () => {
    const container = renderNote('![a diagram](diagram.png)\n\n![a secret](/etc/passwd.png)', null);

    expect(container.querySelector('img')).toBeNull();
    expect(convertFileSrc).not.toHaveBeenCalled();
    expect(container.textContent).toContain('a diagram');
    expect(container.textContent).toContain('a secret');
  });

  it('renders a footnote reference literally, GFM covering no such syntax', () => {
    const container = renderNote('A claim[^1]');

    expect(container.textContent).toContain('[^1]');
  });

  it('renders a wikilink as its own span, brackets gone and prose intact', () => {
    // lezer reports the inner `[My Note]` as a bracket link, so the surrounding text, that node and
    // the trailing bracket are three separate pieces of the walk. Coalescing them into one text run
    // is what lets `renderInlineText` match `[[…]]` at all — without it the link would reach the
    // seam in three pieces and could never be recognized.
    const container = renderNote('See [[My Note]] here');
    const paragraph = container.querySelector('p');

    // No vault tree is loaded here, so the target is missing — which is the *resolver's* business
    // (`resolve-wikilink.test.ts`); what this asserts is that the walk found the link at all.
    expect(paragraph?.textContent).toBe('See My Note here');
    expect(paragraph?.querySelector('[title]')?.textContent).toBe('My Note');
  });
});

describe('renderInlineText', () => {
  // Every run of plain inline text goes through this one function, which is what keeps wikilink
  // resolution in one place; prose with no link in it must still cost nothing.
  it('passes a run of plain text through unchanged', () => {
    expect(renderInlineText('just words')).toBe('just words');
  });
});
