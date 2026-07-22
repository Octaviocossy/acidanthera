import { writeText } from '@tauri-apps/plugin-clipboard-manager';

/** Native system clipboard write boundary. */
export const clipboardService = {
  writeText: (text: string): Promise<void> => writeText(text),
};
