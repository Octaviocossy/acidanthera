import { vaultService } from '@/services/vault.service';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useToastStore } from '@/stores/toast-store';

/** Duplicates a vault entry and moves the sidebar cursor to the new entry. */
export async function duplicateVaultEntry(path: string): Promise<void> {
  try {
    const duplicatePath = await vaultService.duplicateEntry(path);
    useSidebarStore.getState().setCursor(duplicatePath);
  } catch (error) {
    useToastStore.getState().showToast(`Duplicate failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}
