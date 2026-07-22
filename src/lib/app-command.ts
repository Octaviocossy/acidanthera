import { useFileFinderStore } from '@/stores/file-finder-store';

export type AppCommandId = 'find-file';

/** Executes app actions that are shared by multiple input layers. */
export function executeAppCommand(command: AppCommandId): void {
  switch (command) {
    case 'find-file':
      useFileFinderStore.getState().show();
      break;
  }
}
