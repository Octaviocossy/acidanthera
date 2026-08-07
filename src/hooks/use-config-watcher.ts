import { useEffect, useRef } from 'react';
import { getModel } from '@/lib/agent/model-catalog';
import { switchVault } from '@/lib/vault/switch-vault';
import { configService } from '@/services/config.service';
import { type SettingsDiagnostic, type SettingsReadResult, settingsService } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useToastStore } from '@/stores/toast-store';

const SETTINGS_FILE_NAME = 'settings.toml';
/** Coalesces the burst of `notify` events one `fs::write` produces, and the Remove+Create pair
 *  an external editor's save-by-rename emits, into a single reload. */
const DEBOUNCE_MS = 150;

function toastSyntaxError(diagnostic: Extract<SettingsDiagnostic, { kind: 'syntax' }>) {
  const location = diagnostic.line !== null ? `line ${diagnostic.line}` : 'unknown location';
  useToastStore.getState().showToast(`settings.toml (${location}): ${diagnostic.message}`, 'error');
}

function toastFieldFallback(diagnostic: Extract<SettingsDiagnostic, { kind: 'field' }>) {
  useToastStore.getState().showToast(`settings.toml: "${diagnostic.key}" fell back to its default (${diagnostic.message})`, 'error');
}

async function reloadSettings() {
  let result: SettingsReadResult;
  try {
    result = await settingsService.readSettings();
  } catch {
    return;
  }

  const outcome = useSettingsStore.getState().applyReloadedSettings(result);
  if (outcome === 'echo') return;

  if (outcome === 'syntax-error') {
    const syntaxError = result.diagnostics.find((diagnostic): diagnostic is Extract<SettingsDiagnostic, { kind: 'syntax' }> => diagnostic.kind === 'syntax');
    if (syntaxError) toastSyntaxError(syntaxError);
    return;
  }

  for (const diagnostic of result.diagnostics) {
    if (diagnostic.kind === 'field') toastFieldFallback(diagnostic);
  }

  const { settings } = result;

  // Mirrors the boot bootstrap's guard (`use-settings-bootstrap.ts`): a live model change never
  // yanks a turn that's already in flight.
  if (getModel(settings.model) && !useChatStore.getState().sessionStarted) {
    useChatStore.getState().setModel(settings.model);
  }

  // theme/editorFont are picked up reactively by `useApplyTheme` — nothing to do here beyond the
  // `applyReloadedSettings` call above.

  const currentVaultRoot = useAppStore.getState().vaultRoot;
  if (currentVaultRoot !== null && currentVaultRoot !== settings.vaultPath) {
    void switchVault(settings.vaultPath);
  }
}

/**
 * Subscribes to `config-changed` for `settings.toml` and reloads it live (#98, spec decision 6):
 * an in-app dialog save and an external editor's save behave identically. Debounced so the burst
 * of events one write produces collapses into a single reload; `applyReloadedSettings`
 * recognizes the app's own writes echoing back through the watcher and no-ops them (Known Risk
 * #2). A changed `vaultPath` routes through `switchVault` instead of a plain apply, since
 * re-opening the vault is destructive (spec decision 21). Mounted once in `App.tsx`, mirroring
 * `useGlobalKeymap`'s `keymaps.toml` subscription.
 */
export function useConfigWatcher() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const unlistenPromise = configService
      .onConfigChanged((paths) => {
        if (!paths.some((path) => path.endsWith(SETTINGS_FILE_NAME))) return;

        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          void reloadSettings();
        }, DEBOUNCE_MS);
      })
      .catch(() => undefined);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      unlistenPromise.then((unlisten) => unlisten?.()).catch(() => {});
    };
  }, []);
}
