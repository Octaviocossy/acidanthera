/**
 * The *markdown walker* (ADR 0039) — the one renderer behind the *read view*.
 *
 * It is a **walker, not a parser**: the tree comes from `markdownLanguage.parser` — the very object
 * `@codemirror/lang-markdown` hands the editor as its own base (`BufferEditor`), and the one
 * `acidantheraHighlightStyle` binds against. Not two matching configurations but **one**, so the
 * two views cannot drift apart about what a heading, a table or a task list is (invariant 36).
 *
 * That object is the package's *extended* parser, so GFM — tables, task lists, strikethrough — is
 * a fact about the shared base rather than something configured here. Configuring GFM locally is
 * exactly the split this must not have: `markdown()` defaults its base to **commonmark**, so a
 * walker that added GFM on its own would render a table the editor beside it could not see. The
 * editor layers one thing on top, `parseCode`'s nested HTML parser, which only refines the *inside*
 * of an HTML block — a region the read view renders as escaped text either way, so no block or
 * inline construct can mean two things. Footnotes are outside GFM and render as literal text in
 * both, as do the extended parser's subscript, superscript and emoji spans.
 *
 * It emits **React elements and never an HTML string**, which is what makes it sanitizer-free
 * rather than sanitizer-deferred: raw HTML in a note is handed to React as a string child and comes
 * out as escaped, visible text. There is no `dangerouslySetInnerHTML` here and there must never be
 * one — an agent writes these notes.
 */

import { markdownLanguage } from '@codemirror/lang-markdown';
import type { SyntaxNode, Tree } from '@lezer/common';
import { highlightCode } from '@lezer/highlight';
import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Fragment, type ReactNode } from 'react';
import { WikilinkSpan } from '@/components/editor/WikilinkSpan';
import { acidantheraHighlightStyle } from '@/lib/editor/highlight';
import { joinVaultPath } from '@/lib/vault/create-entry';
import { useToastStore } from '@/stores/toast-store';

export interface MarkdownRenderOptions {
  /** The open vault root. A relative image target resolves against it; `null` renders alt text. */
  vaultRoot?: string | null;
  /**
   * Called with a task marker's source range when its checkbox is ticked — the *read view*'s one
   * write (invariant 37). Omitted, every checkbox renders inert, which is what a caller that only
   * displays a note wants.
   */
  onToggleTask?: (markerFrom: number, markerTo: number) => void;
}

interface WalkContext {
  source: string;
  tree: Tree;
  vaultRoot: string | null;
  onToggleTask: ((markerFrom: number, markerTo: number) => void) | null;
}

/**
 * Syntax nodes the read view shows nothing for — the marks that spell the markdown out, plus the
 * parts of a link that are read by their parent rather than rendered in place.
 */
const SKIPPED_NODES = new Set([
  'HeaderMark',
  'ListMark',
  'QuoteMark',
  'LinkMark',
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'CodeInfo',
  'TableDelimiter',
  'TaskMarker',
  'LinkLabel',
  'LinkTitle',
  'URL',
]);

/* Prose styling. Headings stop at `--weight-medium`; 600 stays reserved for strong inline
   emphasis, so the mockup's heavier title is deliberately not reproduced (spec decision 14). */
const STYLE = {
  h1: 'mt-8 mb-3 text-h1 font-medium text-text-primary',
  h2: 'mt-7 mb-3 text-h2 font-medium text-text-primary',
  h3: 'mt-6 mb-2 text-body font-medium text-text-primary',
  paragraph: 'my-3',
  blockquote: 'my-4 border-l-2 border-border pl-4 text-text-secondary italic',
  bulletList: 'my-3 list-disc pl-5',
  orderedList: 'my-3 list-decimal pl-5',
  listItem: 'my-1',
  taskItem: 'my-1 list-none',
  task: 'flex items-start gap-2',
  taskBox: 'mt-[0.35em] shrink-0',
  rule: 'my-6 border-0 border-hairline border-t',
  pre: 'my-4 overflow-x-auto rounded-card bg-elevated p-4',
  codeBlock: 'font-mono text-ui text-text-body',
  inlineCode: 'rounded-kbd bg-elevated px-1 py-0.5 font-mono text-[0.9em] text-text-body',
  strong: 'font-semibold text-text-primary',
  strikethrough: 'text-text-muted line-through',
  // Monochrome, and that is the decision: ember marks a link *into* the vault (ADR 0040), and an
  // external link leaves the app, so it must not look like one that doesn't.
  link: 'text-text-secondary underline underline-offset-2 hover:text-text-primary',
  image: 'my-4 max-w-full rounded-card',
  table: 'my-4 w-full border-collapse text-left',
  headerCell: 'border-border border-b px-2 py-1 font-medium text-text-primary',
  cell: 'border-hairline border-b px-2 py-1',
  htmlBlock: 'my-3 whitespace-pre-wrap',
} as const;

/**
 * Renders a note's markdown source as React elements.
 *
 * The walk slices `source` by each node's `from`/`to`, so every rendered run can be traced back to
 * a source offset — which is what makes the *read view*'s one write, the task-checkbox toggle,
 * possible at all.
 */
export function renderMarkdown(source: string, options: MarkdownRenderOptions = {}): ReactNode {
  const tree = markdownLanguage.parser.parse(source);
  return renderBlockChildren(tree.topNode, { source, tree, vaultRoot: options.vaultRoot ?? null, onToggleTask: options.onToggleTask ?? null });
}

/** The app's own link syntax. Brackets inside a candidate invalidate it, as they do in Rust's
 *  `find_wikilinks` and in the editor's decoration — one grammar, three call sites. */
const WIKILINK_RE = /\[\[[^[\]]+\]\]/g;

/**
 * Every run of plain inline text in a rendered note passes through here, split on `[[…]]`.
 *
 * Markdown's own inline syntax is handled by the walk; the one construct left in a plain run is the
 * app's, and each match becomes a `WikilinkSpan` that resolves against the cached vault tree. The
 * gaps between matches stay bare strings, so prose costs no element it did not already cost.
 *
 * This is why `renderInline` coalesces adjacent plain text first: `[[My Note]]` parses as a literal
 * `[`, a bracket `Link` node and a literal `]`, and the three pieces could never be matched apart.
 */
export function renderInlineText(text: string): ReactNode {
  const out: ReactNode[] = [];
  let pos = 0;
  WIKILINK_RE.lastIndex = 0;
  for (let match = WIKILINK_RE.exec(text); match !== null; match = WIKILINK_RE.exec(text)) {
    if (match.index > pos) out.push(text.slice(pos, match.index));
    out.push(<WikilinkSpan key={match.index} raw={match[0]} />);
    pos = match.index + match[0].length;
  }
  // Prose with no link in it stays the bare string it was, rather than a one-element array.
  if (out.length === 0) return text;
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function slice(node: SyntaxNode, ctx: WalkContext): string {
  return ctx.source.slice(node.from, node.to);
}

function childNamed(node: SyntaxNode, name: string): SyntaxNode | null {
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.name === name) return child;
  }
  return null;
}

function childrenNamed(node: SyntaxNode, name: string): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    if (child.name === name) found.push(child);
  }
  return found;
}

/* ── Blocks ─────────────────────────────────────────────────────────────────────────────────── */

function renderBlockChildren(node: SyntaxNode, ctx: WalkContext): ReactNode[] {
  const rendered: ReactNode[] = [];
  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    const element = renderBlock(child, ctx);
    if (element !== null) rendered.push(element);
  }
  return rendered;
}

function renderBlock(node: SyntaxNode, ctx: WalkContext): ReactNode {
  switch (node.name) {
    case 'Paragraph':
      return (
        <p key={node.from} className={STYLE.paragraph}>
          {renderInline(node, node.from, node.to, ctx)}
        </p>
      );
    case 'ATXHeading1':
    case 'SetextHeading1':
      return renderHeading('h1', node, ctx);
    case 'ATXHeading2':
    case 'SetextHeading2':
      return renderHeading('h2', node, ctx);
    case 'ATXHeading3':
      return renderHeading('h3', node, ctx);
    case 'ATXHeading4':
      return renderHeading('h4', node, ctx);
    case 'ATXHeading5':
      return renderHeading('h5', node, ctx);
    case 'ATXHeading6':
      return renderHeading('h6', node, ctx);
    case 'Blockquote':
      return (
        <blockquote key={node.from} className={STYLE.blockquote}>
          {renderBlockChildren(node, ctx)}
        </blockquote>
      );
    case 'BulletList':
      return (
        <ul key={node.from} className={STYLE.bulletList}>
          {renderBlockChildren(node, ctx)}
        </ul>
      );
    case 'OrderedList':
      return (
        <ol key={node.from} start={orderedListStart(node, ctx)} className={STYLE.orderedList}>
          {renderBlockChildren(node, ctx)}
        </ol>
      );
    case 'ListItem':
      return renderListItem(node, ctx);
    case 'Task':
      return renderTask(node, ctx);
    case 'FencedCode':
    case 'CodeBlock':
      return renderCodeBlock(node, ctx);
    case 'HorizontalRule':
      return <hr key={node.from} className={STYLE.rule} />;
    case 'Table':
      return renderTable(node, ctx);
    // Raw HTML is a string child, so React escapes it and it renders as visible text (invariant 36,
    // spec decision 8). Never `dangerouslySetInnerHTML`, and never a sanitizer.
    case 'HTMLBlock':
    case 'CommentBlock':
      return (
        <p key={node.from} className={STYLE.htmlBlock}>
          {slice(node, ctx)}
        </p>
      );
    // A link-reference definition is addressing, not content — it renders nowhere, as in every
    // other markdown renderer.
    case 'LinkReference':
      return null;
    default:
      if (SKIPPED_NODES.has(node.name)) return null;
      return (
        <p key={node.from} className={STYLE.paragraph}>
          {renderInline(node, node.from, node.to, ctx)}
        </p>
      );
  }
}

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function renderHeading(tag: HeadingTag, node: SyntaxNode, ctx: WalkContext): ReactNode {
  const Tag = tag;
  const { from, to } = headingRange(node, ctx);
  // h3 and below share one step — the type scale stops at `--font-size-h1`/`h2`, and inventing
  // further sizes here would be a parallel scale.
  const className = tag === 'h1' ? STYLE.h1 : tag === 'h2' ? STYLE.h2 : STYLE.h3;
  return (
    <Tag key={node.from} className={className}>
      {renderInline(node, from, to, ctx)}
    </Tag>
  );
}

/**
 * The content range of a heading — the node minus its `#` marks, then minus surrounding
 * whitespace. A setext heading carries its only `HeaderMark` at the *end*, so each side is skipped
 * only when the mark actually sits against that edge.
 */
function headingRange(node: SyntaxNode, ctx: WalkContext): { from: number; to: number } {
  let from = node.from;
  let to = node.to;
  const first = node.firstChild;
  const last = node.lastChild;
  if (first !== null && first.name === 'HeaderMark' && first.from === node.from) from = first.to;
  if (last !== null && last.name === 'HeaderMark' && last.to === node.to && last.from >= from) to = last.from;
  while (from < to && /\s/.test(ctx.source[from])) from += 1;
  while (to > from && /\s/.test(ctx.source[to - 1])) to -= 1;
  return { from, to };
}

function orderedListStart(node: SyntaxNode, ctx: WalkContext): number | undefined {
  const firstItem = childNamed(node, 'ListItem');
  const mark = firstItem === null ? null : childNamed(firstItem, 'ListMark');
  if (mark === null) return undefined;
  const start = Number.parseInt(slice(mark, ctx), 10);
  return Number.isNaN(start) || start === 1 ? undefined : start;
}

function renderListItem(node: SyntaxNode, ctx: WalkContext): ReactNode {
  // A task item draws its own checkbox, so the list marker beside it would be a second bullet for
  // the same row.
  const isTask = childNamed(node, 'Task') !== null;
  return (
    <li key={node.from} className={isTask ? STYLE.taskItem : STYLE.listItem}>
      {renderBlockChildren(node, ctx)}
    </li>
  );
}

/**
 * A GFM task list row, and the one interactive thing the *read view* renders.
 *
 * Ticking the checkbox hands the marker's source range to `onToggleTask`, whose caller rewrites it
 * through `updateBufferContent` — marking the buffer dirty so the change commits through the
 * existing save loop rather than a second save path (invariant 37). `marker.from`/`marker.to` are
 * the offsets that write needs, which is why the walk slices by offset at all.
 *
 * Without that callback the checkbox is `disabled`, so a caller that only displays a note cannot
 * accidentally offer a control that drops its clicks.
 */
function renderTask(node: SyntaxNode, ctx: WalkContext): ReactNode {
  const marker = childNamed(node, 'TaskMarker');
  const checked = marker !== null && /\[[xX]\]/.test(slice(marker, ctx));
  let from = marker === null ? node.from : marker.to;
  while (from < node.to && /[^\S\n]/.test(ctx.source[from])) from += 1;
  const toggle = ctx.onToggleTask;
  const onChange = marker !== null && toggle !== null ? () => toggle(marker.from, marker.to) : undefined;
  // The row's own text is the checkbox's name: `completed task` states only what `checked` already
  // says, which leaves every box on a note announcing the same thing. A wrapped task spans a
  // newline, so the source run is collapsed to one line before it becomes a label.
  const label = ctx.source.slice(from, node.to).replace(/\s+/g, ' ').trim();
  return (
    <span key={node.from} className={STYLE.task}>
      <input
        type="checkbox"
        checked={checked}
        disabled={onChange === undefined}
        readOnly={onChange === undefined}
        onChange={onChange}
        aria-label={label.length > 0 ? label : checked ? 'completed task' : 'incomplete task'}
        className={STYLE.taskBox}
      />
      <span>{renderInline(node, from, node.to, ctx)}</span>
    </span>
  );
}

/**
 * A fenced or indented code block, at the `--font-mono` **token** and never `settings.editorFont`:
 * a display face chosen for the editor should not reach rendered prose (spec decision 9).
 *
 * Its text goes through `@lezer/highlight`'s `highlightCode` driven by the editor's own
 * `acidantheraHighlightStyle`, so a highlighted block carries the editor's exact palette for free
 * (ADR 0039). The shared base configures no nested code parsing, so a language with no Lezer parser
 * in the tree renders as plain mono — the consequence ADR 0039 records. The classes
 * `highlightCode` emits belong to `acidantheraHighlightStyle`'s style module, which
 * `acidantheraHighlighting` mounts; a `ReadView` never exists without a `BufferEditor` beside it in
 * the same `BufferPane`, and without those rules the block still reads correctly as plain mono.
 */
function renderCodeBlock(node: SyntaxNode, ctx: WalkContext): ReactNode {
  // An indented code block carries one `CodeText` per line, each excluding the 4-space indent, so
  // the ranges are highlighted separately rather than as one span that would re-include it.
  const texts = childrenNamed(node, 'CodeText');
  const content = texts.length > 0 ? texts.flatMap((text) => highlightRange(text.from, text.to, ctx)) : [slice(node, ctx)];
  return (
    <pre key={node.from} className={STYLE.pre}>
      <code className={STYLE.codeBlock}>{content}</code>
    </pre>
  );
}

function highlightRange(from: number, to: number, ctx: WalkContext): ReactNode[] {
  const out: ReactNode[] = [];
  highlightCode(
    ctx.source,
    ctx.tree,
    acidantheraHighlightStyle,
    (code, classes) => {
      out.push(
        classes === '' ? (
          code
        ) : (
          <span key={`${from}-${out.length}`} className={classes}>
            {code}
          </span>
        )
      );
    },
    () => out.push('\n'),
    from,
    to
  );
  return out;
}

function renderTable(node: SyntaxNode, ctx: WalkContext): ReactNode {
  const header = childNamed(node, 'TableHeader');
  const rows = childrenNamed(node, 'TableRow');
  return (
    <table key={node.from} className={STYLE.table}>
      {header !== null && (
        <thead>
          <tr>{renderCells(header, 'th', ctx)}</tr>
        </thead>
      )}
      <tbody>
        {rows.map((row) => (
          <tr key={row.from}>{renderCells(row, 'td', ctx)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function renderCells(row: SyntaxNode, tag: 'th' | 'td', ctx: WalkContext): ReactNode[] {
  const Tag = tag;
  return childrenNamed(row, 'TableCell').map((cell) => (
    <Tag key={cell.from} className={tag === 'th' ? STYLE.headerCell : STYLE.cell}>
      {renderInline(cell, cell.from, cell.to, ctx)}
    </Tag>
  ));
}

/* ── Inline ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * Renders `[from, to)` of `node`'s content: each child node in that range, with the plain text
 * between them passed through `renderInlineText`. Plain text has no node of its own in a lezer
 * markdown tree, so the gaps *are* the prose.
 *
 * Adjacent plain text is **coalesced into one run** before it is handed over, and that is
 * load-bearing rather than tidy. `[[My Note]]` parses as a literal `[`, a bracket `Link` node, and
 * a literal `]`, so without coalescing the app's own link syntax would reach `renderInlineText` in
 * three pieces and #162 could never match it. A rendering element — emphasis, code, a real link —
 * ends a run, as does an escape, so `\[\[x\]\]` cannot be mistaken for one either.
 */
function renderInline(node: SyntaxNode, from: number, to: number, ctx: WalkContext): ReactNode[] {
  const out: ReactNode[] = [];
  let run = '';
  let runFrom = from;
  let pos = from;

  const take = (text: string, at: number) => {
    if (run === '') runFrom = at;
    run += text;
  };
  const flush = () => {
    if (run === '') return;
    out.push(<Fragment key={runFrom}>{renderInlineText(run)}</Fragment>);
    run = '';
  };

  for (let child = node.childAfter(from); child !== null && child.from < to; child = child.nextSibling) {
    if (child.from > pos) take(ctx.source.slice(pos, child.from), pos);
    pos = Math.max(pos, child.to);
    // A mark is transparent: it renders nothing and must not split the run around it either.
    if (SKIPPED_NODES.has(child.name)) continue;
    const plain = plainInlineText(child, ctx);
    if (plain !== null) {
      take(plain, child.from);
      continue;
    }
    flush();
    const element = renderInlineNode(child, ctx);
    if (element !== null) out.push(element);
  }

  if (pos < to) take(ctx.source.slice(pos, to), pos);
  flush();
  return out;
}

/**
 * The text of an inline node that is really just text, or `null` when it renders as an element.
 * Two cases, both of which join the surrounding run rather than splitting it.
 *
 * A `[…]` span with **no `(target)`**: lezer reports one for every bracket pair, so this covers an
 * unresolved reference link (`[ref][1]`), a footnote marker (`[^1]`) and — the one that matters —
 * the inner half of a `[[wikilink]]`. CommonMark already calls an unresolved reference literal
 * text, and definitions are not resolved here at all, so rendering the brackets is both correct and
 * the only thing that keeps a wikilink in one piece. Taken as one verbatim slice, so a character
 * reference *inside* the brackets stays literal — a wikilink target is a filename, spelled the way
 * the file is named.
 *
 * A **character reference** (`&amp;`, `&#38;`, `&#x26;`), decoded to the character it names.
 * CommonMark decodes these, and a character reference is *not* HTML markup — it is how markdown
 * spells a character that would otherwise be syntax, so it belongs with the prose and not with the
 * raw-HTML nodes spec decision 8 governs.
 */
function plainInlineText(node: SyntaxNode, ctx: WalkContext): string | null {
  if (node.name === 'Link' && childNamed(node, 'URL') === null) return slice(node, ctx);
  if (node.name === 'Entity') return decodeEntity(slice(node, ctx));
  return null;
}

/**
 * The named character references a note realistically carries. The HTML5 list runs to ~2000 names
 * and shipping it would cost more than every other table in this file put together; an unlisted
 * name renders as its own literal source, which is also what CommonMark says of an *invalid* one.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  dagger: '†',
  sect: '§',
  para: '¶',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  ne: '≠',
  le: '≤',
  ge: '≥',
  infin: '∞',
  larr: '←',
  rarr: '→',
  harr: '↔',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
};

/**
 * Decodes `&amp;` / `&#38;` / `&#x26;` to the character it names, or returns the source unchanged
 * when the reference is unrecognized or names no valid code point.
 *
 * **This is not a relaxation of spec decision 8.** The decoded result is handed to React as a
 * *string child* exactly as everything else here is, so `&lt;script&gt;` decodes to the **text**
 * `<script>` and React escapes it on output — visible text, never markup. Nothing here gains a
 * `dangerouslySetInnerHTML` path, and nothing may. Decoding happens on the string, never through
 * the DOM: an `innerHTML`/`DOMParser` round-trip would be the injection surface ADR 0039 exists to
 * refuse, however it is spelled.
 */
function decodeEntity(source: string): string {
  const body = source.slice(1, -1);
  const numeric = /^#(x)?([0-9a-f]+)$/i.exec(body);
  if (numeric === null) return NAMED_ENTITIES[body] ?? source;
  const code = Number.parseInt(numeric[2], numeric[1] === undefined ? 10 : 16);
  // A surrogate half, a zero, or anything past the last plane names no character CommonMark would
  // render — it substitutes U+FFFD, but leaving the source visible says more to whoever wrote it.
  if (code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return source;
  return String.fromCodePoint(code);
}

function renderInlineNode(node: SyntaxNode, ctx: WalkContext): ReactNode {
  switch (node.name) {
    case 'Emphasis':
      return <em key={node.from}>{renderInline(node, node.from, node.to, ctx)}</em>;
    case 'StrongEmphasis':
      return (
        <strong key={node.from} className={STYLE.strong}>
          {renderInline(node, node.from, node.to, ctx)}
        </strong>
      );
    case 'Strikethrough':
      return (
        <del key={node.from} className={STYLE.strikethrough}>
          {renderInline(node, node.from, node.to, ctx)}
        </del>
      );
    case 'InlineCode':
      return (
        <code key={node.from} className={STYLE.inlineCode}>
          {delimitedText(node, 'CodeMark', ctx)}
        </code>
      );
    case 'Link':
      return renderLink(node, ctx);
    case 'Autolink':
      return renderAutolink(node, ctx);
    case 'Image':
      return renderImage(node, ctx);
    case 'HardBreak':
      return <br key={node.from} />;
    // `\*` renders the escaped character, without its backslash.
    case 'Escape':
      return <Fragment key={node.from}>{ctx.source.slice(node.from + 1, node.to)}</Fragment>;
    // Raw HTML — an inline tag or a comment — is handed to React as a string child, so it renders
    // as the visible text it is written as (spec decision 8). A character reference is **not** raw
    // HTML and is not here: it is decoded, in `plainInlineText`.
    case 'HTMLTag':
    case 'Comment':
      return <Fragment key={node.from}>{slice(node, ctx)}</Fragment>;
    default:
      if (SKIPPED_NODES.has(node.name)) return null;
      return <Fragment key={node.from}>{renderInlineText(slice(node, ctx))}</Fragment>;
  }
}

/** The text between a node's first and last delimiter child — an inline code span's own content. */
function delimitedText(node: SyntaxNode, markName: string, ctx: WalkContext): string {
  const marks = childrenNamed(node, markName);
  const from = marks.length > 0 ? marks[0].to : node.from;
  const to = marks.length > 1 ? marks[marks.length - 1].from : node.to;
  return ctx.source.slice(from, to);
}

/** The label range and target of a `Link` or an `Image`, both of which are `[…](…)` shaped. */
function linkParts(node: SyntaxNode, ctx: WalkContext): { labelFrom: number; labelTo: number; href: string | null } {
  const marks = childrenNamed(node, 'LinkMark');
  const url = childNamed(node, 'URL');
  const labelFrom = marks.length > 0 ? marks[0].to : node.from;
  const labelTo = marks.length > 1 ? marks[1].from : (url?.from ?? node.to);
  return { labelFrom, labelTo, href: url === null ? null : slice(url, ctx) };
}

function isExternalUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function renderLink(node: SyntaxNode, ctx: WalkContext): ReactNode {
  const { labelFrom, labelTo, href } = linkParts(node, ctx);
  const label = renderInline(node, labelFrom, labelTo, ctx);
  // A reference link, a `mailto:`, a `file:` — anything that is not an http(s) target — renders as
  // its own text. There is nothing this app can do with it, and an inert `<a>` would say otherwise.
  if (href === null || !isExternalUrl(href)) return <Fragment key={node.from}>{label}</Fragment>;
  return renderExternalLink(node.from, href, label);
}

function renderAutolink(node: SyntaxNode, ctx: WalkContext): ReactNode {
  const url = childNamed(node, 'URL');
  const href = url === null ? slice(node, ctx).replace(/^<|>$/g, '') : slice(url, ctx);
  if (!isExternalUrl(href)) return <Fragment key={node.from}>{href}</Fragment>;
  return renderExternalLink(node.from, href, href);
}

function renderExternalLink(key: number, href: string, children: ReactNode): ReactNode {
  return (
    <a
      key={key}
      href={href}
      className={STYLE.link}
      onClick={(event) => {
        // The webview would navigate away from the app itself, so the click is always ours: it
        // hands the URL to the OS browser through the opener plugin instead (spec decision 11).
        event.preventDefault();
        void openUrl(href).catch(() => useToastStore.getState().showToast('could not open the link', 'error'));
      }}
    >
      {children}
    </a>
  );
}

/**
 * An image.
 *
 * **Vault-local only** (spec decision 10): a target resolves against the open vault root, must be
 * contained by it, and is then served through the asset protocol — while a target carrying any URI
 * scheme — `https:`, `data:` — renders **its alt text alone and no `<img>`**. A local-first app does
 * not make an outbound request because of something an agent wrote into a note, and does not read
 * outside the vault because of one either (`localImageSrc`).
 */
function renderImage(node: SyntaxNode, ctx: WalkContext): ReactNode {
  const { labelFrom, labelTo, href } = linkParts(node, ctx);
  const alt = ctx.source.slice(labelFrom, labelTo);
  const src = href === null ? null : localImageSrc(href, ctx.vaultRoot);
  if (src === null) return <Fragment key={node.from}>{alt}</Fragment>;
  return <img key={node.from} src={src} alt={alt} className={STYLE.image} />;
}

/** A URI scheme (`https:`, `data:`, `file:`) — anything that is not a plain filesystem path. */
const URI_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The `asset://` URL for a vault-local image, or `null` for anything this app will not read.
 *
 * Containment is enforced **here**, not only at Tauri's scope layer: `allow_vault_assets`
 * (`src-tauri/src/vault.rs`) widens the protocol scope to the adopted root and would refuse an
 * outside path anyway, so this is defence in depth rather than the only guard — but that function's
 * doc comment asserts the frontend *only ever builds a URL from the root it currently holds*, and
 * without this check that sentence is not true. An absolute target used to be handed over
 * unexamined, and a relative one was joined without collapsing `..`, so `![](../../elsewhere.png)`
 * escaped too. Both failed closed one layer down; neither should have got that far.
 *
 * With no vault open there is nothing to contain a path against, so **every** local target renders
 * its alt text — the absolute ones included, which previously bypassed the check entirely.
 */
function localImageSrc(href: string, vaultRoot: string | null): string | null {
  if (URI_SCHEME.test(href) || href.startsWith('//')) return null;
  if (vaultRoot === null) return null;
  const separator = vaultRoot.includes('\\') ? '\\' : '/';
  const decoded = decodePath(href);
  const root = normalizePath(vaultRoot, separator);
  const joined = isAbsolutePath(decoded) ? decoded : joinVaultPath(root, decoded);
  const path = normalizePath(joined, separator);
  if (!isWithin(root, path, separator)) return null;
  try {
    return convertFileSrc(path);
  } catch {
    // Outside a Tauri webview there is no asset protocol to convert against; the alt text is the
    // honest fallback rather than a broken image.
    return null;
  }
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || /^[a-z]:[\\/]/i.test(path);
}

/**
 * Collapses `.` and `..` segments, so a target cannot walk out of the root it was joined onto by
 * spelling its way back up. A `..` that would climb above an absolute prefix is dropped, which is
 * what the filesystem itself does at `/`.
 */
function normalizePath(path: string, separator: string): string {
  const prefix = /^(\/|\\|[a-z]:[\\/])/i.exec(path)?.[0] ?? '';
  const segments: string[] = [];
  for (const segment of path.slice(prefix.length).split(/[\\/]+/)) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') {
      segments.push(segment);
    } else if (segments.length > 0 && segments[segments.length - 1] !== '..') {
      segments.pop();
    } else if (prefix === '') {
      // A relative path may legitimately still be climbing; containment is what rejects it below.
      segments.push(segment);
    }
  }
  return prefix + segments.join(separator);
}

/** Whether `path` is `root` or sits under it — compared on a **separator boundary**, so a sibling
 *  directory whose name merely starts with the root's (`…/vault-backup`) does not pass. */
function isWithin(root: string, path: string, separator: string): boolean {
  if (path === root) return true;
  return path.startsWith(root.endsWith(separator) ? root : root + separator);
}

function decodePath(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}
