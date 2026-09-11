import type { SyntaxNode, Tree } from '@lezer/common';
import { highlightCode } from '@lezer/highlight';
import { parser as commonmarkParser, GFM } from '@lezer/markdown';
import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Fragment, type ReactNode } from 'react';
import { acidantheraHighlightStyle } from '@/lib/editor/highlight';
import { joinVaultPath } from '@/lib/vault/create-entry';
import { useToastStore } from '@/stores/toast-store';

/**
 * The *markdown walker* (ADR 0039) — the one renderer behind the *read view*.
 *
 * It is a **walker, not a parser**: the tree comes from `@lezer/markdown`, the same parser
 * `@codemirror/lang-markdown` builds the editor's tree with and the one `acidantheraHighlightStyle`
 * binds against, so the two views can never disagree about what a heading is (invariant 36). GFM —
 * tables, task lists, strikethrough — comes from the same extension the editor uses; footnotes are
 * outside it and render as literal text.
 *
 * It emits **React elements and never an HTML string**, which is what makes it sanitizer-free
 * rather than sanitizer-deferred: raw HTML in a note is handed to React as a string child and comes
 * out as escaped, visible text. There is no `dangerouslySetInnerHTML` here and there must never be
 * one — an agent writes these notes.
 */
const parser = commonmarkParser.configure(GFM);

export interface MarkdownRenderOptions {
  /** The open vault root. A relative image target resolves against it; `null` renders alt text. */
  vaultRoot?: string | null;
}

interface WalkContext {
  source: string;
  tree: Tree;
  vaultRoot: string | null;
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
  const tree = parser.parse(source);
  return renderBlockChildren(tree.topNode, { source, tree, vaultRoot: options.vaultRoot ?? null });
}

/**
 * Every run of plain inline text in a rendered note passes through here.
 *
 * Today it is the identity: markdown's own inline syntax is already handled by the walk, and
 * nothing else in a text run means anything yet. **Seam for #162 (wikilink resolution)**, which
 * replaces this body with a split on `[[…]]` that resolves each target against the cached vault
 * tree and renders the three link states. It is exported and used from exactly one place for that
 * reason — #162 edits this function, while #163 edits `renderTask`, so the two land without
 * touching each other's lines.
 */
export function renderInlineText(text: string): ReactNode {
  return text;
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
 * A GFM task list row.
 *
 * The checkbox is **disabled** here — the read view renders and does not write (invariant 37).
 * **Seam for #163 (task-checkbox toggling)**, which makes exactly this input interactive: it
 * rewrites the marker's source range through `updateBufferContent`, marking the buffer dirty so
 * the change commits through the existing save loop rather than a second save path. `marker.from`
 * is the offset that write needs, which is why the walk slices by offset at all.
 */
function renderTask(node: SyntaxNode, ctx: WalkContext): ReactNode {
  const marker = childNamed(node, 'TaskMarker');
  const checked = marker !== null && /\[[xX]\]/.test(slice(marker, ctx));
  let from = marker === null ? node.from : marker.to;
  while (from < node.to && /[^\S\n]/.test(ctx.source[from])) from += 1;
  return (
    <span key={node.from} className={STYLE.task}>
      <input type="checkbox" checked={checked} disabled readOnly aria-label={checked ? 'completed task' : 'incomplete task'} className={STYLE.taskBox} />
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
 * (ADR 0039). The parser here is configured with GFM and no nested code parsing, so a language with
 * no Lezer parser in the tree renders as plain mono — the consequence ADR 0039 records. The classes
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
 * The source of an inline node that is really just text, or `null` when it renders as an element.
 *
 * A `[…]` span with no `(target)` is the only case: lezer reports one for every bracket pair, so
 * this covers an unresolved reference link (`[ref][1]`), a footnote marker (`[^1]`) and — the one
 * that matters — the inner half of a `[[wikilink]]`. CommonMark already calls an unresolved
 * reference literal text, and definitions are not resolved here at all, so rendering the brackets
 * is both correct and the only thing that keeps a wikilink in one piece.
 */
function plainInlineText(node: SyntaxNode, ctx: WalkContext): string | null {
  if (node.name === 'Link' && childNamed(node, 'URL') === null) return slice(node, ctx);
  return null;
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
    // An inline HTML tag, an HTML comment and a character entity are all handed to React as string
    // children, so each renders as the visible text it is written as (spec decision 8).
    case 'HTMLTag':
    case 'Comment':
    case 'Entity':
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
 * **Vault-local only** (spec decision 10): a relative target resolves against the open vault root
 * and is served through the asset protocol, while a target carrying any URI scheme — `https:`,
 * `data:` — renders **its alt text alone and no `<img>`**. A local-first app does not make an
 * outbound request because of something an agent wrote into a note.
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

function localImageSrc(href: string, vaultRoot: string | null): string | null {
  if (URI_SCHEME.test(href) || href.startsWith('//')) return null;
  const decoded = decodePath(href);
  const isAbsolute = decoded.startsWith('/') || /^[a-z]:[\\/]/i.test(decoded);
  if (!isAbsolute && vaultRoot === null) return null;
  const path = isAbsolute ? decoded : joinVaultPath(vaultRoot as string, decoded);
  try {
    return convertFileSrc(path);
  } catch {
    // Outside a Tauri webview there is no asset protocol to convert against; the alt text is the
    // honest fallback rather than a broken image.
    return null;
  }
}

function decodePath(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}
