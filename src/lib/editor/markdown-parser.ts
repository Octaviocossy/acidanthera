import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { type Language, type LanguageSupport, StreamLanguage } from '@codemirror/language';
import { css } from '@codemirror/legacy-modes/mode/css';
import { diff } from '@codemirror/legacy-modes/mode/diff';
import { go } from '@codemirror/legacy-modes/mode/go';
import { javascript, json, typescript } from '@codemirror/legacy-modes/mode/javascript';
import { python } from '@codemirror/legacy-modes/mode/python';
import { rust } from '@codemirror/legacy-modes/mode/rust';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { standardSQL } from '@codemirror/legacy-modes/mode/sql';
import { html } from '@codemirror/legacy-modes/mode/xml';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { styleTags, Tag, tags } from '@lezer/highlight';
import { tomlLanguage } from '@/lib/editor/toml-language';

/**
 * The tag `CodeText` is re-tagged to, distinct from `InlineCode`'s `tags.monospace`
 * (`markdownHighlighting` in `@lezer/markdown` otherwise gives both the same tag, so a
 * `HighlightStyle` cannot style them differently — the inline-code chip lands on every fenced
 * line).
 *
 * Deliberately **not** `tags.content`: that tag already means `Paragraph` in the same grammar
 * (`markdownHighlighting`'s own `Paragraph: tags.content`), so reusing it here would bleed the
 * fenced-code color onto every paragraph of prose in the editor, which shares one
 * `HighlightStyle` across the whole document. A fresh, disjoint tag has no such ancestor.
 */
export const fenceContentTag = Tag.define();

/** `@codemirror/legacy-modes/mode/javascript` exports JS, TS and JSON from one file — one import
 *  covers `js`/`jsx`/`mjs`/`cjs`, `ts`/`tsx`, and `json` with their own dedicated stream modes. */
const jsLanguage = StreamLanguage.define(javascript);
const tsLanguage = StreamLanguage.define(typescript);
const jsonLanguage = StreamLanguage.define(json);

const registry: Record<string, Language> = {
  js: jsLanguage,
  jsx: jsLanguage,
  mjs: jsLanguage,
  cjs: jsLanguage,
  javascript: jsLanguage,
  ts: tsLanguage,
  tsx: tsLanguage,
  typescript: tsLanguage,
  rust: StreamLanguage.define(rust),
  rs: StreamLanguage.define(rust),
  python: StreamLanguage.define(python),
  py: StreamLanguage.define(python),
  json: jsonLanguage,
  yaml: StreamLanguage.define(yaml),
  yml: StreamLanguage.define(yaml),
  toml: tomlLanguage,
  shell: StreamLanguage.define(shell),
  sh: StreamLanguage.define(shell),
  bash: StreamLanguage.define(shell),
  zsh: StreamLanguage.define(shell),
  sql: StreamLanguage.define(standardSQL),
  css: StreamLanguage.define(css),
  html: StreamLanguage.define(html),
  htm: StreamLanguage.define(html),
  go: StreamLanguage.define(go),
  golang: StreamLanguage.define(go),
  diff: StreamLanguage.define(diff),
  patch: StreamLanguage.define(diff),
};

/**
 * The *fence language registry* (spec decision 7): resolves a fenced code block's info string to
 * the `Language` that highlights it, or `null` for anything outside the curated twelve — which
 * renders as plain mono rather than raising an error (spec decision 9).
 *
 * `info` arrives already stripped of anything after the first whitespace — `getCodeParser` in
 * `@codemirror/lang-markdown` does that before calling this function — so only the case and
 * surrounding whitespace of the language token itself are this function's business.
 */
export function fenceLanguage(info: string): Language | null {
  return registry[info.trim().toLowerCase()] ?? null;
}

/**
 * The one configured markdown parser (invariant 36, ADR 0125): `BufferEditor` and the *markdown
 * walker* both consume this same object, so a fenced code block's language and its `InlineCode`
 * vs. `CodeText` distinction cannot drift between the two views. Built once, at module scope —
 * `acidantheraMarkdown()` returns this same `LanguageSupport` rather than reconfiguring on every
 * call.
 *
 * A curated stream mode is assumed well-behaved: none of the twelve above is known to leave its
 * `StreamParser.token` non-advancing, and guarding every call against that would add a recovery
 * path with no failing case to test it against. Should one ever throw
 * "Stream parser failed to advance stream", it propagates out of the whole parse (Residual
 * Unknown in the spec) — accepted here rather than solved speculatively.
 */
const acidantheraMarkdownSupport: LanguageSupport = markdown({
  base: markdownLanguage,
  codeLanguages: fenceLanguage,
  extensions: { props: [styleTags({ InlineCode: tags.monospace, CodeText: fenceContentTag })] },
});

export function acidantheraMarkdown(): LanguageSupport {
  return acidantheraMarkdownSupport;
}

/** The `Parser` the *markdown walker* parses with — `acidantheraMarkdown().language.parser`,
 *  named separately because the walker has no `LanguageSupport` of its own to hold. */
export const markdownParser = acidantheraMarkdownSupport.language.parser;
