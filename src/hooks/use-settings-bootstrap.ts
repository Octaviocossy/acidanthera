import { useEffect } from 'react';
import { getModel } from '@/lib/agent/model-catalog';
import { vaultService } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';

/**
 * Boot-time settings bootstrap (#25), mounted once in `App.tsx`. Loads the persisted settings,
 * seeds the chat's engine, then opens the vault at `settings.vaultPath` — creating the default
 * `~/Documents/orbit-brain` on first run — so the app starts with a working vault instead of
 * the manual "Open vault…" step (which remains the recovery path if this fails).
 */
export function useSettingsBootstrap() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const settings = await useSettingsStore.getState().loadSettings();
        if (cancelled) return;

        // Seed the persisted model choice — the file is hand-editable, so only adopt a model the
        // catalog knows — but never yank a session the user already started.
        if (getModel(settings.model) && !useChatStore.getState().sessionStarted) {
          useChatStore.getState().setModel(settings.model);
        }

        // Don't stomp a vault the user managed to open before the bootstrap finished.
        if (useAppStore.getState().vaultRoot !== null) return;
        const root = await vaultService.openVault(settings.vaultPath);
        if (cancelled) return;
        useAppStore.getState().setVaultRoot(root);
      } catch {
        // Every failing command is logged backend-side (logs/orbit-111.log); `vaultRoot`
        // stays null, so the sidebar's "Open vault…" button remains the recovery path.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
