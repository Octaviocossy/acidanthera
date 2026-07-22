import { vaultService } from '@/services/vault.service';
import type { EditorSaveRequest } from '@/stores/editor-store';

/** Writes the immutable content snapshot captured when a buffer save was requested. */
export function saveBuffer(request: EditorSaveRequest): Promise<void> {
  return vaultService.writeNote(request.filePath, request.content);
}
