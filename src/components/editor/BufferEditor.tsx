import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo } from 'react';
import { applyEditorKeymap } from '@/lib/editor/apply-vim-keymap';
import { editorKeymapExtension, trackEditorView } from '@/lib/editor/keymap-compartment';
import { regionExit } from '@/lib/editor/region-exit';
import { editorTheme } from '@/lib/editor/theme';
import { vimModeSync } from '@/lib/editor/vim-mode-sync';
import { wikilink } from '@/lib/editor/wikilink';
import { cn } from '@/lib/utils';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSettingsStore } from '@/stores/settings-store';

interface BufferEditorProps {
  buffer: EditorBuffer;
  active: boolean;
}

/** A permanently mounted CodeMirror view for one editor buffer. */
export function BufferEditor({ buffer, active }: BufferEditorProps) {
  const theme = useSettingsStore((state) => state.settings?.theme ?? 'dark');
  const updateBufferContent = useEditorStore((state) => state.updateBufferContent);
  const resolvedKeymap = useKeymapStore((state) => state.resolved);

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
      markdown(),
      vimModeSync(buffer.id),
      ...wikilink,
      EditorView.lineWrapping,
      editorTheme(theme === 'dark'),
    ],
    [buffer.id, theme]
  );

  useEffect(() => {
    applyEditorKeymap(resolvedKeymap);
  }, [resolvedKeymap]);

  return (
    <div id={`editor-buffer-${buffer.id}`} role="tabpanel" className={cn('h-full min-h-0', active ? 'block' : 'hidden')}>
      <CodeMirror
        className="h-full"
        value={buffer.content}
        onChange={(content) => updateBufferContent(buffer.id, content)}
        extensions={extensions}
        theme="none"
        height="100%"
        basicSetup={{ lineNumbers: true, foldGutter: false }}
      />
    </div>
  );
}
