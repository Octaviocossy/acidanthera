import { useMemo } from 'react';
import { getViewerScrollContainer } from '@/lib/editor/viewer-scroll-container';
import { type DispatcherCommand, type DispatcherLayer, useDispatcherLayer } from '@/lib/keymap/dispatcher';
import { useAppStore } from '@/stores/app-store';
import { activeEditorBuffer, useEditorStore } from '@/stores/editor-store';
import { useKeymapStore } from '@/stores/keymap-store';

/** Approximate line height in pixels, used only when the container's computed `line-height`
 *  can't be read as a number (e.g. the keyword `normal`). */
const FALLBACK_LINE_HEIGHT_PX = 24;

function lineHeightOf(container: HTMLElement): number {
  const parsed = Number.parseFloat(getComputedStyle(container).lineHeight);
  return Number.isFinite(parsed) ? parsed : FALLBACK_LINE_HEIGHT_PX;
}

/** Runs `action` against the live scroll container, a no-op with none registered — e.g. between a
 *  buffer closing and the layer going inactive on the next keydown (spec decision 24). */
function withContainer(action: (container: HTMLElement) => void): void {
  const container = getViewerScrollContainer();
  if (container !== null) action(container);
}

function scrollDown(): void {
  withContainer((container) => container.scrollTo({ top: container.scrollTop + lineHeightOf(container) }));
}

function scrollUp(): void {
  withContainer((container) => container.scrollTo({ top: container.scrollTop - lineHeightOf(container) }));
}

function halfPageDown(): void {
  withContainer((container) => container.scrollTo({ top: container.scrollTop + container.clientHeight / 2 }));
}

function halfPageUp(): void {
  withContainer((container) => container.scrollTo({ top: container.scrollTop - container.clientHeight / 2 }));
}

function gotoTop(): void {
  withContainer((container) => container.scrollTo({ top: 0 }));
}

function gotoBottom(): void {
  withContainer((container) => container.scrollTo({ top: container.scrollHeight }));
}

/**
 * The read view's reading verbs (issue #170, ADR 0130): scroll-only vim motions plus save,
 * contributed as the `[viewer]` layer to the shared window dispatcher
 * (`src/lib/keymap/dispatcher.ts`) instead of a `ReadView`-local `keydown` handler — the same
 * reason every other region layer already goes through `useDispatcherLayer` rather than its own
 * listener: a literal `j`/`k`/`G` in a handler is not something `keymaps.toml` can rebind.
 *
 * `viewer.save` is dispatched here rather than through `executeAppCommand`, kept consistent with
 * the scroll verbs beside it: they need the live scroll container from
 * `viewer-scroll-container.ts`, which only this hook's closures hold, so splitting `viewer.save`
 * out to the shared switch would leave one of the seven verbs dispatched a different way than its
 * six siblings for no reason.
 *
 * Active only while the viewer is the focused region, the app is in normal mode, and the active
 * buffer exists and is showing its *read view* — inactive on the *home surface* (no buffer) and
 * inactive while the *edit view* shows instead. Sets no `swallows`: only `modal` swallows
 * (invariant 25), so a chord this layer's trie does not match still reaches `global` underneath it
 * (e.g. `Ctrl-w b` still toggles the sidebar from the read view).
 */
export function useViewerKeymap() {
  const layerBindings = useKeymapStore((state) => state.resolved.layers.viewer);

  const commands = useMemo<DispatcherCommand[]>(
    () => [
      { id: 'viewer.scroll-down', chords: layerBindings.get('viewer.scroll-down') ?? [], run: scrollDown },
      { id: 'viewer.scroll-up', chords: layerBindings.get('viewer.scroll-up') ?? [], run: scrollUp },
      { id: 'viewer.half-page-down', chords: layerBindings.get('viewer.half-page-down') ?? [], run: halfPageDown },
      { id: 'viewer.half-page-up', chords: layerBindings.get('viewer.half-page-up') ?? [], run: halfPageUp },
      { id: 'viewer.goto-top', chords: layerBindings.get('viewer.goto-top') ?? [], run: gotoTop },
      { id: 'viewer.goto-bottom', chords: layerBindings.get('viewer.goto-bottom') ?? [], run: gotoBottom },
      { id: 'viewer.save', chords: layerBindings.get('viewer.save') ?? [], run: () => useEditorStore.getState().requestSave() },
    ],
    [layerBindings]
  );

  const layer = useMemo<DispatcherLayer>(
    () => ({
      name: 'viewer',
      commands,
      isActive: () => {
        const app = useAppStore.getState();
        if (app.activeRegion !== 'viewer' || app.mode !== 'normal') return false;
        const buffer = activeEditorBuffer(useEditorStore.getState());
        return buffer !== null && buffer.view === 'read';
      },
    }),
    [commands]
  );

  useDispatcherLayer(layer);
}
