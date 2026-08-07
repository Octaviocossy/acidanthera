import { type ConfigFileName, configService } from '@/services/config.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';

/**
 * Opens a config file (`settings.toml` / `keymaps.toml`) into the editor as a `source: 'config'`
 * buffer, mirroring `openVaultFile`'s path-dedup behavior: an already-open config buffer is
 * activated instead of re-read, never overwriting unsaved edits (invariant 6).
 */
export async function openConfigFile(name: ConfigFileName): Promise<void> {
  const existing = useEditorStore.getState().buffers.find((buffer) => buffer.source === 'config' && buffer.filePath === name);
  if (existing !== undefined) {
    useEditorStore.getState().activateBuffer(existing.id);
    useAppStore.getState().focusRegion('viewer');
    return;
  }

  const content = await configService.readConfigFile(name);
  useEditorStore.getState().openFile(name, content, 'config');
  useAppStore.getState().focusRegion('viewer');
}
