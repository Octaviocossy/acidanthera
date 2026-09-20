import { Button } from '@/components/ui/button';
import { BookOpen, Icon, Pencil } from '@/components/ui/icon';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import { useCommandChord } from '@/hooks/use-chord-title';
import { tooltipTarget } from '@/lib/tooltip/tooltip-overlay';
import { cn } from '@/lib/utils';
import { activeEditorBuffer, useEditorStore } from '@/stores/editor-store';

/**
 * The *view toggle*: the control that changes the active buffer's *buffer view*, right-aligned in
 * the viewer's *chrome strip*.
 *
 * The second control ever admitted to that strip under ADR 0123, which lets in a control acting on
 * *what the window is showing* — which is exactly what a view toggle is (spec decision 15). It is
 * **monochrome**, never ember: a view toggle asserts no AI agency, and chrome stays monochrome
 * unless the control *is* the AI surface (invariants 21, 27).
 *
 * Drawn only for a `source: 'vault'` buffer and **hidden** otherwise — hide-never-disable, the rule
 * the *sidebar context menu* already follows for an inapplicable item (decision 2). It is also the
 * read view's only mode indicator, which is why the *editor status cluster* carries none.
 *
 * Two icon-only buttons, following the sidebar's chrome pattern (`Sidebar.tsx`) rather than the
 * shared `Segmented` — widening `Segmented`'s `readonly string[]` contract for two glyphs would be
 * churn against the one job it still does for the settings theme row. Each carries a hover reveal
 * with its label and the live `global.toggle-view` chord, read through the hook rather than a
 * `getState()` snapshot so a `keymaps.toml` rebind updates it without a restart (invariant 31).
 */
export function ViewToggle() {
  const buffer = useEditorStore(activeEditorBuffer);
  const setBufferView = useEditorStore((state) => state.setBufferView);
  const toggleViewChord = useCommandChord('global.toggle-view');

  if (buffer === null || buffer.source === 'config') return null;

  const isRead = buffer.view === 'read';

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-6 w-6 p-0', isRead && 'bg-elevated')}
        aria-label="Read view"
        aria-pressed={isRead}
        {...tooltipTarget(<TooltipHint label="Read" chord={toggleViewChord} />, { placement: 'below' })}
        onClick={() => setBufferView(buffer.id, 'read')}
      >
        <Icon icon={BookOpen} size={15} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-6 w-6 p-0', !isRead && 'bg-elevated')}
        aria-label="Edit view"
        aria-pressed={!isRead}
        {...tooltipTarget(<TooltipHint label="Edit" chord={toggleViewChord} />, { placement: 'below' })}
        onClick={() => setBufferView(buffer.id, 'edit')}
      >
        <Icon icon={Pencil} size={15} />
      </Button>
    </div>
  );
}
