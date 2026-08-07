import { create } from 'zustand';
import { openVaultRoot } from '@/hooks/use-settings-bootstrap';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useToastStore } from '@/stores/toast-store';

type DirtyBufferDecision = 'save' | 'discard' | 'cancel';

/** A vault switch waiting on a dirty-buffer decision. `resolve` both answers the waiting
 *  `switchVault` call and clears this state, so `SwitchVaultDialog` disappears the instant a
 *  button is clicked — the save/close work that follows happens after the dialog is gone. */
interface PendingVaultSwitch {
  newPath: string;
  resolve: (decision: DirtyBufferDecision) => void;
}

interface VaultSwitchPromptState {
  pending: PendingVaultSwitch | null;
}

const useVaultSwitchPromptStore = create<VaultSwitchPromptState>(() => ({ pending: null }));

/** Read by `SwitchVaultDialog` (`src/components/layout/SwitchVaultDialog.tsx`) — `null` when no
 *  switch is waiting on a decision. */
export function useVaultSwitchPrompt(): PendingVaultSwitch | null {
  return useVaultSwitchPromptStore((state) => state.pending);
}

function promptForDirtyBuffers(newPath: string): Promise<DirtyBufferDecision> {
  return new Promise((resolve) => {
    useVaultSwitchPromptStore.setState({
      pending: {
        newPath,
        resolve: (decision) => {
          useVaultSwitchPromptStore.setState({ pending: null });
          resolve(decision);
        },
      },
    });
  });
}

/** Waits until none of `requestIds` remain in the save queue — i.e. `useSaveLoop` (mounted once
 *  in `App.tsx`) has completed or failed every one of them. */
function waitForSaveRequestsToClear(requestIds: number[]): Promise<void> {
  if (requestIds.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.saveRequests.some((request) => requestIds.includes(request.id))) return;
      unsubscribe();
      resolve();
    });
  });
}

export type VaultSwitchOutcome = 'switched' | 'cancelled' | 'failed';

/**
 * Re-opens the vault at `newPath`, live-applying a changed `settings.toml` `vaultPath` (spec
 * decision 21). Dirty buffers block the switch behind one consolidated Save all / Discard all /
 * Cancel prompt — never a per-buffer dialog (invariant 8). Cancel aborts the switch entirely:
 * the vault stays open and `newPath` is left un-applied, even though `settings.toml` already
 * holds it on disk — the running app simply keeps ignoring that value until the buffers are
 * resolved or the file changes again.
 */
export async function switchVault(newPath: string): Promise<VaultSwitchOutcome> {
  const dirtyBuffers = useEditorStore.getState().buffers.filter((buffer) => buffer.dirty);

  if (dirtyBuffers.length > 0) {
    const decision = await promptForDirtyBuffers(newPath);
    if (decision === 'cancel') return 'cancelled';

    if (decision === 'save') {
      const before = new Set(useEditorStore.getState().saveRequests.map((request) => request.id));
      for (const buffer of dirtyBuffers) {
        useEditorStore.getState().requestSave(buffer.id);
      }
      const requestIds = useEditorStore
        .getState()
        .saveRequests.filter((request) => !before.has(request.id))
        .map((request) => request.id);

      await waitForSaveRequestsToClear(requestIds);

      const stillDirty = dirtyBuffers.some((buffer) => useEditorStore.getState().buffers.find((candidate) => candidate.id === buffer.id)?.dirty);
      if (stillDirty) {
        useToastStore.getState().showToast("Couldn't switch vault: a buffer failed to save", 'error');
        return 'failed';
      }
    }
  }

  for (const buffer of useEditorStore.getState().buffers) {
    useEditorStore.getState().closeBuffer(buffer.id);
  }

  try {
    const root = await openVaultRoot(newPath);
    useAppStore.getState().setVaultRoot(root);
    return 'switched';
  } catch (error) {
    useToastStore.getState().showToast(`Couldn't open vault: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return 'failed';
  }
}
