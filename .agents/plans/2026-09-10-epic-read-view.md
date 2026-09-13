# Plan: Epic — Read view

> Status: **draft**
> Created: 2026-09-10
> Updated: 2026-09-10
> Issue: #157
> Integration branch: epic/157-read-view

## Goal

Give every vault note two ways to be looked at: the existing CodeMirror **edit view** over raw
markdown, and a new **read view** that renders it — prose in proportional sans, a header block
naming the note, and a Read/Edit toggle in the chrome strip.

Design spec: `.agents/specs/2026-09-10-read-view.md` (settled — 32 decisions, 7 rounds).
ADRs: 0125 (markdown renders through the editor's parser), 0126 (ember extends to wikilinks).

## Children & Waves

| Wave | Issue | Branch | Title | Status |
|------|-------|--------|-------|--------|
| 1 | #158 | `158-buffer-view-and-view-toggle` | Buffer view, the view toggle, and `global.toggle-view` | pending |
| 2 | #159 | `159-markdown-walker` | The markdown walker | pending |
| 2 | #160 | `160-read-view-status-cluster` | Read-view status cluster | pending |
| 3 | #161 | `161-note-header-block` | The note header block | pending |
| 3 | #162 | `162-wikilink-resolution` | Wikilink resolution and the three link states | pending |
| 3 | #163 | `163-task-checkbox-toggling` | Task-checkbox toggling in the read view | pending |
| 4 | #164 | `164-reconcile-read-view-docs` | Reconcile v0-spec, the design skill, and tech-stack | pending |

## Dependency Edges

```
159 -> 158
160 -> 158
161 -> 159
162 -> 159
163 -> 159
164 -> 159
164 -> 162
```

## Shared-Artifact Notes

Wave 3 is the only place two children touch one file, and it is handled by construction rather than
by luck:

- **`src/lib/editor/markdown-walker.tsx`** is created by #159 and modified by **#162** and **#163**.
  #159 must land two **named seams** that render inert placeholders — `renderInlineText` (a
  pass-through, replaced by #162) and a **disabled** task checkbox (made interactive by #163) — each
  with a comment naming its issue. Each wave-3 child then edits one distinct existing function
  instead of both appending to a shared switch.
- **`src/components/editor/ReadView.tsx`** is created by #158, filled in by #159, and touched again
  by **#161** (mounts the header, strips a leading H1) and **#163** (threads the task-toggle
  callback). Different regions of the file; low conflict risk.
- **Offset interaction between #161 and #163.** #161 renders
  `renderMarkdown(stripLeadingH1(buffer.content))`, so node offsets become relative to the stripped
  source while #163's `toggleTaskAt` runs against the original. Whichever integrates second must
  reconcile — the intended fix is for `stripLeadingH1` to return `{ source, offset }` and for
  `ReadView` to add `offset` back before calling `toggleTaskAt`. Recorded in #163's Step 3.

## Architecture Decisions

- **Foundation-first.** #158 lands the shared types (`BufferView`), the `BufferPane` wrapper, the
  toggle, the command, and the `ReadView` shell, so every sibling only *adds*. It is also the sole
  writer of `editor-store.ts`, `EditorTabs.tsx`, `Viewer.tsx`, `app-command.ts`,
  `keymap/defaults.ts`, `region-exit-gesture.ts` and `segmented.tsx` for the whole epic.
- **Data-before-UI.** #159 (the walker) precedes every child that renders through it.
- **Docs last.** #164 waits on #159 and #162 so it describes what actually shipped — including
  whether #159's deferred inner-language code highlighting stayed deferred.
- **The glossary is already written.** `.agents/ubiquitous-language.md` was updated during the
  design interrogation. #164 verifies it against the merged code and removes the two "settled ahead
  of implementation" markers; no other child edits it.

## Validation Criteria

- [ ] All seven children integrated into `epic/157-read-view`
- [ ] `pnpm check && pnpm build && pnpm test` pass on the epic branch
- [ ] `pnpm check:rust && pnpm test:rust` pass (touched by #158 and #159)
- [ ] Opening a note lands in read; `Ctrl-w e` toggles; a newly created note lands in edit
- [ ] A note with headings, lists, a table, code, images and links renders as a document
- [ ] Wikilinks are ember and navigable in both views; broken ones are struck through in both
- [ ] A read-view checkbox toggles, marks dirty, and persists on `:w`
- [ ] Both glossary markers removed; no doc contradicts the shipped behavior
- [ ] One `epic → main` PR opened, closing #157

## Open Questions

**One, flagged to the epic author before execution.** #159 defers **inner-language syntax
highlighting** inside fenced code blocks. Decision 9 chose "reuse the editor's highlighting", and
#159 honors it for the style source (`acidantheraHighlightStyle`'s `monospace`/`literal` spec gives
code its colour, background, radius and padding) but does **not** colour tokens per language:
`highlightCode` needs a tree parsed in the code's own language, and no language parser is a direct
dependency — `@codemirror/lang-javascript` is not installed at all. Doing it properly means
promoting per-language Lezer parsers and wiring nested parsing, which is a slice of its own. If
per-language colouring is wanted in this epic, add it as an eighth child depending on #159 before
running `/execute-epic`.
