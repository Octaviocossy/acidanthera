import type { Range } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

const WIKILINK_RE = /\[\[[^[\]]+\]\]/g;

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    WIKILINK_RE.lastIndex = 0;
    let match = WIKILINK_RE.exec(text);
    while (match !== null) {
      const start = from + match.index;
      ranges.push(Decoration.mark({ class: 'cm-wikilink' }).range(start, start + match[0].length));
      match = WIKILINK_RE.exec(text);
    }
  }

  return Decoration.set(ranges);
}

const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (instance) => instance.decorations,
  }
);

// Chromatic-free per the design system — subdued by default, bright on hover, never accented.
const wikilinkStyle = EditorView.baseTheme({
  '.cm-wikilink': {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  '.cm-wikilink:hover': {
    color: 'var(--text-primary)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
});

/**
 * Inline `[[wikilink]]` rendering (doc/v0-spec.md §5.1, §5.6 `Wikilink`) — a hand-built CM6
 * decoration over the raw markdown source (brackets stay visible), not a mounted React
 * component, since it renders inside editor text.
 */
export const wikilink = [wikilinkPlugin, wikilinkStyle];
