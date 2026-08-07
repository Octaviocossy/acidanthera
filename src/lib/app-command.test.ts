import { beforeEach, describe, expect, it } from 'vitest';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { executeAppCommand } from './app-command';

const initialFileFinderState = useFileFinderStore.getState();

beforeEach(() => {
  useFileFinderStore.setState(initialFileFinderState, true);
});

describe('executeAppCommand', () => {
  it('opens the file finder for global.find-file', () => {
    executeAppCommand('global.find-file');

    expect(useFileFinderStore.getState().open).toBe(true);
  });
});
