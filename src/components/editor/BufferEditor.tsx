import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useState } from 'react';
import { applyEditorKeymap } from '@/lib/editor/apply-vim-keymap';
import { acidantheraHighlighting } from '@/lib/editor/highlight';
import { editorKeymapExtension, trackEditorView } from '@/lib/editor/keymap-compartment';
import { regionExit } from '@/lib/editor/region-exit';
import { editorTheme } from '@/lib/editor/theme';
import { tomlLanguage } from '@/lib/editor/toml-language';
import { vimModeSync } from '@/lib/editor/vim-mode-sync';
import { wikilink } from '@/lib/editor/wikilink';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSettingsStore } from '@/stores/settings-store';

interface BufferEditorProps {
  buffer: EditorBuffer;
  active: boolean;
  /** True while this buffer is showing its *read view* instead. The view stays mounted — hiding it
   *  is what keeps undo history and cursor position across a toggle (spec decision 6). */
  hidden: boolean;
}

/** A permanently mounted CodeMirror view for one editor buffer — the *edit view* half of a
 *  `BufferPane`, which owns the tabpanel wrapper this used to render itself. */
export function BufferEditor({ buffer, active, hidden }: BufferEditorProps) {
  const theme = useSettingsStore((state) => state.settings?.theme ?? 'dark');
  const updateBufferContent = useEditorStore((state) => state.updateBufferContent);
  const setCursor = useEditorStore((state) => state.setCursor);
  const resolvedKeymap = useKeymapStore((state) => state.resolved);
  const viewerActive = useAppStore((state) => state.activeRegion === 'viewer');
  const focusRequest = useAppStore((state) => state.editorFocusRequest);

  // `@uiw/react-codemirror` installs its container through a ref callback (`setContainer`) and
  // builds the `EditorView` in a `useLayoutEffect` keyed on that container — so the view lands in a
  // *second* commit, after this component's first passive effect has already flushed. A `useRef`
  // filled by `onCreateEditor` would still read null there; state re-runs the focus effect below at
  // exactly the moment the view exists.
  const [view, setView] = useState<EditorView | null>(null);

  // Deliberately NOT keyed on the resolved keymap: `editorKeymapExtension` only seeds the
  // compartment's *initial* content (read live via `getState()`, not the reactive `resolvedKeymap`
  // above). A live keymap change is applied by the effect below via `reconfigureEditorKeymap`,
  // which swaps the compartment's content in place — adding a keymap dep here would rebuild
  // `EditorState` on every config save and destroy undo history and cursor position with it.
  const extensions = useMemo(
    () => [
      vim(),
      regionExit(),
      editorKeymapExtension(useKeymapStore.getState().resolved),
      trackEditorView(),
      // `base: markdownLanguage` is the GFM-extended parser, and the *markdown walker* the read view
      // runs on parses with that same object. Without it `markdown()` defaults to bare **commonmark**,
      // so a table, a task list or `~~strikethrough~~` would render as GFM in read and as plain text
      // here — the disagreement invariant 36 exists to prevent, and load-bearing for #163, which
      // toggles task checkboxes. One shared base is what makes the invariant hold by construction
      // rather than by two call sites happening to agree; it also makes
      // `acidantheraHighlightStyle`'s `tags.strikethrough` rule reachable in the editor for the
      // first time.
      buffer.source === 'config' ? tomlLanguage : markdown({ base: markdownLanguage }),
      acidantheraHighlighting,
      vimModeSync(buffer.id),
      // Wikilinks are a Markdown-note concept and meaningless in TOML.
      ...(buffer.source === 'config' ? [] : wikilink),
      EditorView.lineWrapping,
      editorTheme(theme === 'dark'),
    ],
    [buffer.id, buffer.source, theme]
  );

  useEffect(() => {
    applyEditorKeymap(resolvedKeymap);
  }, [resolvedKeymap]);

  useEffect(() => {
    if (!active || view === null) return;
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    setCursor({ line: line.number, col: view.state.selection.main.head - line.from + 1 });
  }, [active, view, setCursor]);

  // Real DOM focus follows the focused region. The window dispatcher bails on any `contenteditable`
  // target (`isEditableTarget`), so the two halves have to agree: region focus without DOM focus
  // leaves an opened note untypable, and DOM focus without region focus leaves the sidebar's `j`/`k`
  // dead while those keystrokes land in the buffer instead. `focusRequest` re-triggers this for an
  // open that changes nothing else — re-opening the already-active buffer from the file finder,
  // whose input just unmounted and took DOM focus to `<body>` with it.
  useEffect(() => {
    if (view === null) return;
    // `view.dom`, not `contentDOM`: vim's `:`/`/` prompt is a CodeMirror panel mounted inside
    // `view.dom` that closes itself on blur, so focus sitting there counts as already owned.
    // `view.hasFocus` is deliberately unused — it ANDs in `document.hasFocus()`, so a backgrounded
    // window would report false and skip the blur.
    const holdsFocus = view.dom.contains(view.root.activeElement);
    // `!hidden` as well, or the editor and the `ReadView` beside it fight over DOM focus on every
    // toggle — both are mounted, and only the visible one may claim it.
    if (active && viewerActive && !hidden) {
      if (!holdsFocus) view.focus();
    } else if (holdsFocus) {
      view.contentDOM.blur();
    }
  }, [view, active, viewerActive, hidden, focusRequest]);

  return (
    // The native `hidden` attribute as well as the utility class, for the reason `ReadView` carries
    // it: the surface that is not showing leaves the accessible tree, not just the paint.
    <div hidden={hidden} className={cn('h-full min-h-0', hidden && 'hidden')}>
      <CodeMirror
        className="h-full"
        value={buffer.content}
        onChange={(content) => updateBufferContent(buffer.id, content)}
        onCreateEditor={setView}
        extensions={extensions}
        theme="none"
        height="100%"
        basicSetup={{ lineNumbers: true, foldGutter: false }}
      />
    </div>
  );
}
