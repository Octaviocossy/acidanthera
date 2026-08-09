import { useMemo } from 'react';
import { type DispatcherCommand, type DispatcherLayer, useDispatcherLayer } from '@/lib/keymap/dispatcher';
import { hasModalOverlay, topModalOverlay } from '@/lib/keymap/modal-overlay';
import { useKeymapStore } from '@/stores/keymap-store';

/** Contributes the single swallowing `[modal]` layer to the shared window dispatcher. Open
 * overlays register their callbacks in `modal-overlay.ts`; they never register layers themselves. */
export function useModalKeymap(): void {
  const layerBindings = useKeymapStore((state) => state.resolved.layers.modal);

  const commands = useMemo<DispatcherCommand[]>(
    () => [
      { id: 'modal.cancel', chords: layerBindings.get('modal.cancel') ?? [], run: () => topModalOverlay()?.onCancel() },
      { id: 'modal.confirm', chords: layerBindings.get('modal.confirm') ?? [], run: () => topModalOverlay()?.onConfirm?.() },
    ],
    [layerBindings]
  );

  const layer = useMemo<DispatcherLayer>(() => ({ name: 'modal', commands, swallows: true, isActive: hasModalOverlay }), [commands]);

  useDispatcherLayer(layer);
}
