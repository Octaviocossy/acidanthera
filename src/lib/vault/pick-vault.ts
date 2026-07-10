import { vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useSettingsStore } from '@/stores/settings-store';

/**
 * Opens the native folder picker, adopts the choice as the vault root, and persists it into
 * `settings.vaultPath` so it reopens on the next boot (#25). Shared by the sidebar's
 * "Open vault…" action and the settings dialog's vault row (#29) — the same pattern as
 * `openVaultFile`. Resolves to the picked root, or `null` when the picker is cancelled.
 */
export async function pickAndPersistVault(): Promise<string | null> {
  let root: string;
  try {
    root = await vaultService.pickVault();
  } catch {
    // Dialog was cancelled — nothing to do.
    return null;
  }
  useAppStore.getState().setVaultRoot(root);
  void useSettingsStore.getState().updateSettings({ vaultPath: root });
  return root;
}
