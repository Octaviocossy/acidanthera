import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';
import { regionExit } from '@/lib/editor/region-exit';
import { saveKeymap } from '@/lib/editor/save';
import { editorTheme } from '@/lib/editor/theme';
import { vimModeSync } from '@/lib/editor/vim-mode-sync';
import { wikilink } from '@/lib/editor/wikilink';
import '@/lib/editor/yank';
import { cn } from '@/lib/utils';
import { type EditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useSettingsStore } from '@/stores/settings-store';

interface BufferEditorProps {
  buffer: EditorBuffer;
  active: boolean;
}

/** A permanently mounted CodeMirror view for one editor buffer. */
export function BufferEditor({ buffer, active }: BufferEditorProps) {
  const theme = useSettingsStore((state) => state.settings?.theme ?? 'dark');
  const updateBufferContent = useEditorStore((state) => state.updateBufferContent);
  const extensions = useMemo(
    () => [vim(), regionExit(), saveKeymap, markdown(), vimModeSync(buffer.id), ...wikilink, EditorView.lineWrapping, editorTheme(theme === 'dark')],
    [buffer.id, theme]
  );

  return (
    <div className={cn('h-full min-h-0', active ? 'block' : 'hidden')}>
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
