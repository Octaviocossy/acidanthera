import { type ConfigFileName, configService } from '@/services/config.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';

/**
 * Opens a config file (`settings.toml` / `keymaps.toml`) into the editor as a `source: 'config'`
 * buffer, mirroring `openVaultFile`'s path-dedup behavior: an already-open config buffer is
 * activated instead of re-read, never overwriting unsaved edits (invariant 6). Focus handling
 * mirrors it too — `focusEditor` moves both the region and real DOM focus into the editor.
 */
export async function openConfigFile(name: ConfigFileName): Promise<void> {
  const existing = useEditorStore.getState().buffers.find((buffer) => buffer.source === 'config' && buffer.filePath === name);
  if (existing !== undefined) {
    useEditorStore.getState().activateBuffer(existing.id);
    useAppStore.getState().focusEditor();
    return;
  }

  const content = await configService.readConfigFile(name);
  // No *buffer view* is passed: a `source: 'config'` buffer is forced to `'edit'` by the store,
  // because TOML has nothing to render and the *view toggle* is not drawn for it (spec decision 2).
  useEditorStore.getState().openFile(name, content, 'config');
  useAppStore.getState().focusEditor();
}
