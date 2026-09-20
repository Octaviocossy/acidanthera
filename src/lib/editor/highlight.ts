import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { fenceContentTag } from '@/lib/editor/markdown-parser';

/** Markdown typography and code-token colour, kept separate from editor chrome in `theme.ts`. */
export const acidantheraHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-h1)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' },
  { tag: tags.heading2, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-h2)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' },
  { tag: tags.strong, fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--text-primary)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  // The chip: `InlineCode` alone (step 3 in #168 moved fenced content off `tags.monospace` onto
  // `fenceContentTag`), so it no longer lands on every line of a `<pre>`.
  {
    tag: tags.monospace,
    color: 'var(--text-body)',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-kbd)',
    padding: '0 0.2em',
  },
  // Fenced/indented code content: same text colour as the chip, no box — a language-less fence
  // renders as plain mono, and a recognized one only colours the tokens the six rules below name.
  { tag: [tags.literal, fenceContentTag], color: 'var(--text-body)' },
  { tag: [tags.link, tags.url], color: 'var(--text-secondary)', textDecoration: 'underline' },
  { tag: tags.quote, color: 'var(--text-secondary)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--text-secondary)' },
  { tag: tags.processingInstruction, color: 'var(--text-muted)' },
  // Syntax palette (invariant 59, ADR 0131) — lexical categories inside fenced code, in both
  // views. Operators, punctuation and plain identifiers are deliberately left unmapped (spec
  // decision 5): they stay on the text ladder via `fenceContentTag` above.
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.atom], color: 'var(--syntax-literal)' },
  { tag: tags.comment, color: 'var(--syntax-comment)' },
  { tag: [tags.definition(tags.variableName), tags.typeName], color: 'var(--syntax-name)' },
  { tag: [tags.standard(tags.variableName), tags.meta], color: 'var(--syntax-builtin)' },
]);

export const acidantheraHighlighting = syntaxHighlighting(acidantheraHighlightStyle);
