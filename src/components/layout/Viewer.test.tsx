import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { Viewer } from './Viewer';

describe('Viewer', () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppStore.setState({ activeRegion: 'viewer' });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
  });

  it('shows the branded empty state when no notes are open', () => {
    render(<Viewer />);

    expect(screen.getByText('ORBIT')).toBeInTheDocument();
    expect(screen.getByText('Ctrl-w f to open a note')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
