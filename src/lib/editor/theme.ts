import { EditorView } from '@codemirror/view';

/**
 * CM6 theme reading the Orbit-111 design tokens (doc/v0-spec.md §5.1, §5.6) so the editor
 * stays visually identical to the rest of the chrome. Uses the raw `--*` CSS variables
 * (not Tailwind utilities) per the note in `src/styles/tokens/spacing.css`.
 */
export const editorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
    },
    '&.cm-editor.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      caretColor: 'var(--text)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--font-size-base)',
      padding: 'var(--space-4) var(--space-6)',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.6',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--text)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--surface-2)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg)',
      color: 'var(--text-faint)',
      border: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--surface)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'var(--surface-2)',
      outline: 'none',
    },
  },
  { dark: true }
);
