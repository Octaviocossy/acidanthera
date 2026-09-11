import { Segmented } from '@/components/ui/segmented';
import { activeEditorBuffer, useEditorStore } from '@/stores/editor-store';

const READ = 'Read';
const EDIT = 'Edit';
const OPTIONS = [READ, EDIT] as const;

/**
 * The *view toggle*: the control that changes the active buffer's *buffer view*, right-aligned in
 * the viewer's *chrome strip*.
 *
 * The second control ever admitted to that strip under ADR 0037, which lets in a control acting on
 * *what the window is showing* — which is exactly what a view toggle is (spec decision 15). It is
 * **monochrome**, never ember: a view toggle asserts no AI agency, and chrome stays monochrome
 * unless the control *is* the AI surface (invariants 21, 27).
 *
 * Drawn only for a `source: 'vault'` buffer and **hidden** otherwise — hide-never-disable, the rule
 * the *sidebar context menu* already follows for an inapplicable item (decision 2). It is also the
 * read view's only mode indicator, which is why the *editor status cluster* carries none.
 *
 * No icons, deviating from the mockup: `Segmented` takes `readonly string[]`, and widening a
 * primitive the settings dialog shares for two glyphs is churn against its one job.
 */
export function ViewToggle() {
  const buffer = useEditorStore(activeEditorBuffer);
  const setBufferView = useEditorStore((state) => state.setBufferView);

  if (buffer === null || buffer.source === 'config') return null;

  return <Segmented options={OPTIONS} value={buffer.view === 'read' ? READ : EDIT} onChange={(option) => setBufferView(buffer.id, option === READ ? 'read' : 'edit')} />;
}
