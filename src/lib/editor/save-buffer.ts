import { type ConfigFileName, configService } from '@/services/config.service';
import { vaultService } from '@/services/vault.service';
import type { EditorSaveRequest } from '@/stores/editor-store';

/** Writes the immutable content snapshot captured when a buffer save was requested, routed by
 *  `source` (#100): a vault note through `vaultService.writeNote`, a config file through the
 *  allowlisted config command. */
export function saveBuffer(request: EditorSaveRequest): Promise<void> {
  if (request.source === 'config') return configService.writeConfigFile(request.filePath as ConfigFileName, request.content);
  return vaultService.writeNote(request.filePath, request.content);
}
