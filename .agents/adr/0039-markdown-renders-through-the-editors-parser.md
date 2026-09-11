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

`@lezer/markdown` and `@lezer/common` are promoted from transitive to direct dependencies. Raw HTML
in a note renders as **escaped text**, never executed — that is what makes this choice
sanitizer-free rather than sanitizer-deferred. Code blocks are highlighted by `@lezer/highlight`'s
`highlightCode` driven by the existing `acidantheraHighlightStyle`, so they carry the editor's exact
palette; a language with no Lezer parser in the tree renders as plain mono. Footnotes are outside
the GFM extension and render as literal text.
