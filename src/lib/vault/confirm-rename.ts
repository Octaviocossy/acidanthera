import { create } from 'zustand';
import type { WikilinkScan } from '@/services/vault.service';

export type RenameConfirmationDecision = 'confirm' | 'cancel';

export interface PendingRenamePrompt {
  oldStem: string;
  newStem: string;
  scan: WikilinkScan;
  resolve: (decision: RenameConfirmationDecision) => void;
}

interface RenamePromptState {
  pending: PendingRenamePrompt | null;
}

const useRenamePromptStore = create<RenamePromptState>(() => ({ pending: null }));

/** The wikilink confirmation waiting for a decision, or `null` when no rename is pending. */
export function useRenamePrompt(): PendingRenamePrompt | null {
  return useRenamePromptStore((state) => state.pending);
}

/** Opens the shared wikilink confirmation gate and resolves after the user confirms or cancels. */
export function requestRenameConfirmation(oldStem: string, newStem: string, scan: WikilinkScan): Promise<RenameConfirmationDecision> {
  return new Promise((resolve) => {
    useRenamePromptStore.setState({
      pending: {
        oldStem,
        newStem,
        scan,
        resolve: (decision) => {
          useRenamePromptStore.setState({ pending: null });
          resolve(decision);
        },
      },
    });
  });
}
