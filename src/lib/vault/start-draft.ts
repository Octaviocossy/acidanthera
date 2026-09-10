import { resolveDraftParent } from '@/lib/vault/create-entry';
import { flattenVisibleTree } from '@/lib/vault/flatten-tree';
import { useAppStore } from '@/stores/app-store';
import { type EntryDraftKind, useSidebarStore } from '@/stores/sidebar-store';

/**
 * Starts a cursor-relative *entry draft* in the sidebar, reading everything it needs from the
 * stores rather than from a component's scope. The single implementation behind every
 * **cursor-relative** create-verb invocation — the `a`/`A` chords, their mouse twins in the
 * *primary nav*, the rail's buttons, and `global.new-note` — so one command behaves one way
 * however it is invoked.
 *
 * The *sidebar context menu* deliberately keeps its own starter: it resolves the parent from the
 * right-clicked **target** via `resolveParentForTarget`, where `null` means the vault root
 * explicitly — a case this function's cursor-based `resolveDraftParent` cannot express.
 *
 * Expanding the sidebar comes first: a draft has nowhere to render at 40px, and `focusRegion` is
 * refused while collapsed (a collapsed rail is not a reachable focus region, invariant 24), which
 * would otherwise leave a draft begun in a region the user cannot see or type into.
 */
export function startNoteDraft(kind: EntryDraftKind): void {
  const app = useAppStore.getState();
  const sidebar = useSidebarStore.getState();
  if (app.vaultRoot === null) return;

  app.expandSidebar();
  const rows = flattenVisibleTree(sidebar.tree, sidebar.expanded);
  const parentPath = resolveDraftParent(rows, sidebar.cursorPath, app.vaultRoot);
  if (parentPath === null) return;

  app.focusRegion('sidebar');
  sidebar.beginDraft(kind, parentPath);
}
