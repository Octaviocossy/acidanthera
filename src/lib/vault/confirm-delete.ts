import { create } from 'zustand';
import type { DeletionSummary } from '@/lib/vault/delete-entry';

export type DeleteConfirmationDecision = 'confirm' | 'cancel';

export interface PendingDeletePrompt {
  path: string;
  summary: DeletionSummary;
  resolve: (decision: DeleteConfirmationDecision) => void;
}

interface DeletePromptState {
  pending: PendingDeletePrompt | null;
}

const useDeletePromptStore = create<DeletePromptState>(() => ({ pending: null }));

/** The delete confirmation waiting for a decision, or `null` when no deletion is pending. */
export function useDeletePrompt(): PendingDeletePrompt | null {
  return useDeletePromptStore((state) => state.pending);
}

/** Opens the shared delete confirmation gate and resolves after the user confirms or cancels. */
export function requestDeleteConfirmation(path: string, summary: DeletionSummary): Promise<DeleteConfirmationDecision> {
  return new Promise((resolve) => {
    useDeletePromptStore.setState({
      pending: {
        path,
        summary,
        resolve: (decision) => {
          useDeletePromptStore.setState({ pending: null });
          resolve(decision);
        },
      },
    });
  });
}
