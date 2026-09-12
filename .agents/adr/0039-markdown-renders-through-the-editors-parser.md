# Markdown renders through the editor's own parser

The *read view* needs markdown as React elements, and the app had no renderer of any kind. It
renders by walking a `@lezer/markdown` tree — the parser already in the dependency graph via
`@codemirror/lang-markdown`, and the one the editor's `acidantheraHighlightStyle` binds against —
rather than adding `react-markdown` or a `marked`/DOMPurify pair. One parser serves both views, so
edit and read can never disagree about what a heading is; GFM comes from the same extension the
editor already uses; and because the walker emits React elements and never an HTML string, there is
no sanitizer to keep correct and no injection surface at all in an app where an agent writes the
notes.

## Considered Options

- **`react-markdown` + `remark-gfm`** — roughly one line to write, versus the ~300 the walker costs.
  Rejected because it puts a **second markdown parser** in the app permanently: the two would
  disagree about edge cases forever, and the disagreement would surface as "the editor highlighted
  this as a heading and the read view didn't."
- **`marked`/`markdown-it` + DOMPurify + `dangerouslySetInnerHTML`** — smallest bundle. Rejected
  because it buys a permanent HTML-injection surface, and the thing writing the notes is an agent.

## Consequences

`@lezer/common` alone is promoted from transitive to direct — for the `SyntaxNode`/`Tree` types the
walker's signatures name. `@lezer/markdown` is deliberately *not*: the walker parses with
`markdownLanguage.parser` from `@codemirror/lang-markdown`, which the app already depends on for the
editor. That is stronger than the direct dependency this ADR first planned for, not weaker — the two
views share one parser **object** rather than two configurations of the same package, so they cannot
drift apart through configuration, which is what invariant 36 actually asks for. Raw HTML
in a note renders as **escaped text**, never executed — that is what makes this choice
sanitizer-free rather than sanitizer-deferred. Code blocks are highlighted by `@lezer/highlight`'s
`highlightCode` driven by the existing `acidantheraHighlightStyle`, so they carry the editor's exact
palette; a language with no Lezer parser in the tree renders as plain mono. Footnotes are outside
the GFM extension and render as literal text.

## Walker mechanics

These are the walker's non-obvious behaviors. They live here rather than in the glossary row,
which states what the walker *is* and cites this ADR for the rest (ADR 0043's one-claim rule).

**Adjacent plain text is coalesced into a single run** before `renderInlineText` sees it. This is
load-bearing, not tidiness: lezer reports a bracket span for every `[…]` pair, so `[[My Note]]`
parses as a literal `[`, a bracket link and a literal `]`. Without coalescing the app's own link
syntax would reach *wikilink resolution* in three pieces and could never be matched. A `[…]` span
with **no `(target)`** is literal text, not a link; an unresolved reference link and a footnote
marker render literally for the same reason, which is also what CommonMark says of them.

**Character references are decoded** — `&amp;` renders `&`, numeric forms included, an
unrecognized one staying literal — then join the surrounding run, because a character reference is
how markdown spells a character rather than markup of its own. This relaxes nothing about raw
HTML: the decoded text is still a React string child, so `&lt;script&gt;` is visible text and never
an element.

**Images are vault-local only.** A target is joined to the open `vaultRoot`, normalized so `..`
cannot climb out, and must be **contained** by that root before it is served through Tauri's asset
protocol; a target carrying any URI scheme, or any local target at all with no vault open,
renders its alt text and no `<img>`. That containment check is **defence in depth, not the only
guard** — the scope layer below would refuse an outside path anyway, but `allow_vault_assets`'
doc comment asserts that the frontend only ever builds a URL from the root it currently holds, and
only `localImageSrc` can make that sentence true. The protocol's configured scope is **empty** and
is widened at runtime to the adopted vault root alone, the root being user-picked, so no static
pattern could name it without being far broader than the one directory that may be read.

**A task checkbox is interactive only when the caller passes `onToggleTask`.** Without it every box
is `disabled`, so a caller that merely displays a note cannot offer a control that silently drops
its clicks. Each box is named after its own row's source text rather than by its state, which
`checked` already carries — otherwise every task on a note announces the same label.
