import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/app-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { FileFinder } from './FileFinder';

const { openVaultFile } = vi.hoisted(() => ({ openVaultFile: vi.fn() }));
const { openConfigFile } = vi.hoisted(() => ({ openConfigFile: vi.fn() }));
const longRelativePath = 'notes/projects/very-long-project-name/meeting-notes/architecture-decisions.md';
vi.mock('@/lib/vault/open-file', () => ({ openVaultFile }));
vi.mock('@/lib/config/open-config-file', () => ({ openConfigFile }));

afterEach(cleanup);

beforeEach(() => {
  openVaultFile.mockReset();
  openConfigFile.mockReset();
  useAppStore.setState({ vaultRoot: '/vault' });
  useSidebarStore.setState({
    tree: [
      {
        name: 'notes',
        path: '/vault/notes',
        isDir: true,
        children: [
          { name: 'ideas.md', path: '/vault/notes/ideas.md', isDir: false, children: null },
          {
            name: 'projects',
            path: '/vault/notes/projects',
            isDir: true,
            children: [
              {
                name: 'very-long-project-name',
                path: '/vault/notes/projects/very-long-project-name',
                isDir: true,
                children: [
                  {
                    name: 'meeting-notes',
                    path: '/vault/notes/projects/very-long-project-name/meeting-notes',
                    isDir: true,
                    children: [
                      {
                        name: 'architecture-decisions.md',
                        path: '/vault/notes/projects/very-long-project-name/meeting-notes/architecture-decisions.md',
                        isDir: false,
                        children: null,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  useFileFinderStore.getState().hide();
});

describe('FileFinder', () => {
  it('renders an accessible combobox with recursively discovered notes', () => {
    useFileFinderStore.getState().show();
    render(<FileFinder />);

    expect(screen.getByRole('dialog', { name: 'Find file' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getByRole('option', { name: 'notes/ideas.md' })).toBeInTheDocument();
  });

  it('renders matching files as full-width vertical rows and exposes long paths', () => {
    useFileFinderStore.getState().show();
    render(<FileFinder />);

    const listbox = screen.getByRole('listbox', { name: 'Matching files' });
    const option = screen.getByRole('option', { name: 'notes/ideas.md' });
    const longPathOption = screen.getByRole('option', { name: longRelativePath });

    expect(listbox).toHaveClass('flex', 'flex-col');
    expect(option).toHaveClass('w-full', 'min-w-0', 'truncate', 'text-left');
    expect(longPathOption).toHaveAttribute('title', longRelativePath);
  });

  it('filters and opens the highlighted result with Enter', async () => {
    const user = userEvent.setup();
    openVaultFile.mockResolvedValue(undefined);
    useFileFinderStore.getState().show();
    render(<FileFinder />);

    await user.type(screen.getByRole('combobox'), 'idea');
    await user.keyboard('{Enter}');

    expect(openVaultFile).toHaveBeenCalledWith('/vault/notes/ideas.md');
    expect(useFileFinderStore.getState().open).toBe(false);
  });

  it('lists config files alongside vault notes, visually marked', () => {
    useFileFinderStore.getState().show();
    render(<FileFinder />);

    const option = screen.getByRole('option', { name: 'config/settings.tomlconfig' });
    expect(option).toBeInTheDocument();
  });

  it('opens a selected config file through openConfigFile, not openVaultFile', async () => {
    const user = userEvent.setup();
    openConfigFile.mockResolvedValue(undefined);
    useFileFinderStore.getState().show();
    render(<FileFinder />);

    await user.type(screen.getByRole('combobox'), 'settings.toml');
    await user.keyboard('{Enter}');

    expect(openConfigFile).toHaveBeenCalledWith('settings.toml');
    expect(openVaultFile).not.toHaveBeenCalled();
    expect(useFileFinderStore.getState().open).toBe(false);
  });
});
