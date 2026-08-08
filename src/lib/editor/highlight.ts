import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/** Markdown typography, kept separate from editor chrome in `theme.ts`. */
export const orbitHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-h1)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' },
  { tag: tags.heading2, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-h2)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' },
  { tag: tags.strong, fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--text-primary)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  {
    tag: [tags.monospace, tags.literal],
    color: 'var(--text-body)',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-kbd)',
    padding: '0 0.2em',
  },
  { tag: [tags.link, tags.url], color: 'var(--text-secondary)', textDecoration: 'underline' },
  { tag: tags.quote, color: 'var(--text-secondary)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--text-secondary)' },
  { tag: tags.processingInstruction, color: 'var(--text-muted)' },
]);

export const orbitHighlighting = syntaxHighlighting(orbitHighlightStyle);
