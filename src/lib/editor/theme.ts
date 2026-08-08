import { EditorView } from '@codemirror/view';

/**
 * CM6 theme spec reading the Orbit-111 design tokens (doc/v0-spec.md §5.1, §5.6) so the
 * editor stays visually identical to the rest of the chrome. Uses the raw `--*` CSS
 * variables (not Tailwind utilities) per the note in `src/styles/tokens/spacing.css`.
 * Colors flip with the active palette automatically; the font comes from `--editor-font`
 * (`settings.editorFont`, applied by `useApplyTheme`, #28).
 */
const THEME_SPEC = {
  '&': {
    height: '100%',
    backgroundColor: 'var(--bg-canvas)',
    color: 'var(--text-body)',
  },
  '&.cm-editor.cm-focused': {
    outline: 'none',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    fontFamily: 'var(--editor-font)',
    fontSize: 'var(--font-size-body)',
    padding: '28px 36px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--editor-font)',
    lineHeight: 'var(--leading-prose)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--text-primary)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--bg-hover)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-canvas)',
    color: 'var(--text-muted)',
    border: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 var(--space-2) 0 var(--space-4)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-panel)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'var(--bg-elevated)',
    outline: 'none',
  },
};

/**
 * Builds the editor theme for the active palette. The `dark` flag only selects CM6's
 * base-theme defaults (`&light`/`&dark` selectors) — every color we set ourselves is a
 * token variable, so it must track `settings.theme` (#28) via `Viewer`'s memo.
 */
export function editorTheme(dark: boolean) {
  return EditorView.theme(THEME_SPEC, { dark });
}
