import { markdown } from '@codemirror/lang-markdown';
import { vim } from '@replit/codemirror-vim';
import CodeMirror from '@uiw/react-codemirror';
import { Badge } from '@/components/ui/badge';
import { regionExit } from '@/lib/editor/region-exit';
import { saveKeymap } from '@/lib/editor/save';
import { editorTheme } from '@/lib/editor/theme';
import { vimModeSync } from '@/lib/editor/vim-mode-sync';
import { wikilink } from '@/lib/editor/wikilink';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';

// Module-level: recreating this array on every render would make @uiw/react-codemirror
// reconfigure the CM6 state (losing cursor position / undo history) on every keystroke.
// `vim()` goes first per doc/v0-spec.md §5.1; `regionExit`/`saveKeymap` are `Prec.highest`
// internally so their array position doesn't matter.
const EXTENSIONS = [vim(), regionExit(), saveKeymap, markdown(), editorTheme, vimModeSync, ...wikilink];

/** The CodeMirror 6 markdown editor region — vim-first, `Ctrl-w` region-exit (doc/v0-spec.md §5.1). */
export function Viewer() {
  const isActive = useAppStore((state) => state.activeRegion === 'viewer');
  const content = useEditorStore((state) => state.content);
  const setContent = useEditorStore((state) => state.setContent);
  const vimMode = useEditorStore((state) => state.vimMode);

  return (
    <main aria-label="Editor" className={cn('relative flex h-full flex-1 flex-col overflow-hidden border-t-2 bg-bg', isActive ? 'border-border-active' : 'border-transparent')}>
      <div className="min-h-0 flex-1">
        <CodeMirror value={content} onChange={setContent} extensions={EXTENSIONS} theme="none" height="100%" basicSetup={{ lineNumbers: true, foldGutter: false }} />
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3">
        <Badge tone="muted">{vimMode}</Badge>
      </div>
    </main>
  );
}
