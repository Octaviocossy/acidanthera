import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_NAVIGATION_HISTORY } from '@/lib/editor/navigation-history';
import { resolveKeymap } from '@/lib/keymap/resolve';
import { RAIL_WIDTH, SIDEBAR_DEFAULT_WIDTH, sidebarRenderedWidth } from '@/lib/layout/panel-widths';
import { startNoteDraft } from '@/lib/vault/start-draft';
import type { Settings } from '@/services/settings.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useFileFinderStore } from '@/stores/file-finder-store';
import { useKeymapStore } from '@/stores/keymap-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { Sidebar } from './Sidebar';

const { openVaultFile, readVaultTree, onVaultChanged } = vi.hoisted(() => ({
  openVaultFile: vi.fn(),
  readVaultTree: vi.fn(),
  onVaultChanged: vi.fn(),
}));

vi.mock('@/lib/vault/open-file', () => ({ openVaultFile }));
vi.mock('@/services/vault.service', () => ({ vaultService: { readVaultTree, onVaultChanged } }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// Stands in for the macOS Reduce Motion setting: jsdom has no `matchMedia`, and Motion reads the
// preference once, so the OS boundary is mocked at the hook that reports it.
const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => reducedMotion.value }));

const initialAppState = useAppStore.getState();
const initialSidebarState = useSidebarStore.getState();
const initialSettingsState = useSettingsStore.getState();
const SETTINGS: Settings = { model: 'sonnet-5', editorFont: 'Geist Mono', theme: 'dark', vaultPath: '/vault', dailyNoteFolder: 'daily', contentZoom: 1 };
const tree = [{ name: 'readme.md', path: '/vault/readme.md', isDir: false, modified: null, children: null }];

/** The face (a direct child of the aside) that contains `element`. */
const faceOf = (element: HTMLElement) => Array.from(screen.getByRole('complementary', { name: 'Vault explorer' }).children).find((face) => face.contains(element)) as HTMLElement;

describe('Sidebar panel motion', () => {
  beforeEach(() => {
    openVaultFile.mockReset();
    readVaultTree.mockResolvedValue(tree);
    onVaultChanged.mockResolvedValue(() => {});
    useAppStore.setState(initialAppState, true);
    useAppStore.setState({ vaultRoot: '/vault', sidebarExpanded: false });
    useSidebarStore.setState(initialSidebarState, true);
    useSidebarStore.setState({ tree, expanded: new Set(), cursorPath: null, draft: null });
    useSettingsStore.setState(initialSettingsState, true);
    useSettingsStore.setState({ settings: SETTINGS, diagnostics: [] });
    useEditorStore.setState({ buffers: [], activeBufferId: null, history: EMPTY_NAVIGATION_HISTORY });
    useFileFinderStore.getState().hide();
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(initialAppState, true);
    useSidebarStore.setState(initialSidebarState, true);
    useSettingsStore.setState(initialSettingsState, true);
    useEditorStore.setState({ buffers: [], activeBufferId: null, history: EMPTY_NAVIGATION_HISTORY });
    useKeymapStore.setState({ resolved: resolveKeymap(null) });
    reducedMotion.value = false;
    sidebarRenderedWidth.jump(SIDEBAR_DEFAULT_WIDTH);
  });

  it('keeps one aside mounted across a collapse and an expand', () => {
    useAppStore.setState({ sidebarExpanded: true });
    render(<Sidebar />);
    const aside = screen.getByRole('complementary', { name: 'Vault explorer' });
    act(() => useAppStore.getState().collapseSidebar());
    expect(screen.getByRole('complementary', { name: 'Vault explorer' })).toBe(aside);
    act(() => useAppStore.getState().expandSidebar());
    expect(screen.getByRole('complementary', { name: 'Vault explorer' })).toBe(aside);
  });

  it('applies the first width without a tween, in either state', () => {
    sidebarRenderedWidth.jump(SIDEBAR_DEFAULT_WIDTH);
    render(<Sidebar />);
    expect(sidebarRenderedWidth.get()).toBe(RAIL_WIDTH);
    expect(screen.queryByRole('tree', { hidden: true })).not.toBeInTheDocument();
    cleanup();
    sidebarRenderedWidth.jump(RAIL_WIDTH);
    useAppStore.setState({ sidebarExpanded: true });
    render(<Sidebar />);
    expect(sidebarRenderedWidth.get()).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(screen.queryByRole('button', { name: 'Expand sidebar', hidden: true })).not.toBeInTheDocument();
  });

  it('drives the shared rendered width to the rail and back', async () => {
    useAppStore.setState({ sidebarExpanded: true });
    render(<Sidebar />);
    expect(sidebarRenderedWidth.get()).toBe(SIDEBAR_DEFAULT_WIDTH);
    act(() => useAppStore.getState().collapseSidebar());
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Vault explorer' })).toHaveStyle({ width: `${RAIL_WIDTH}px` }));
    act(() => useAppStore.getState().expandSidebar());
    await waitFor(() => expect(sidebarRenderedWidth.get()).toBe(SIDEBAR_DEFAULT_WIDTH));
  });

  it('makes the leaving explorer inert and hidden in the same act as the collapse', async () => {
    useAppStore.setState({ sidebarExpanded: true, activeRegion: 'sidebar' });
    render(<Sidebar />);
    act(() => useAppStore.getState().collapseSidebar());
    const tree = screen.getByRole('tree', { hidden: true });
    expect(tree.closest('[inert]')).not.toBeNull();
    expect(tree.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Expand sidebar' }).closest('[inert]')).toBeNull();
    expect(useAppStore.getState().activeRegion).toBe('viewer');
    await waitFor(() => expect(screen.queryByRole('tree', { hidden: true })).not.toBeInTheDocument());
  });

  it('hands a draft begun from the rail to an explorer that takes keys at once', async () => {
    render(<Sidebar />);
    act(() => startNoteDraft('note'));
    const input = screen.getByRole('textbox', { name: 'New note name' });
    expect(input).toHaveFocus();
    expect(input.closest('[inert]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand sidebar', hidden: true }).closest('[inert]')).not.toBeNull();
    await userEvent.setup().keyboard('plan');
    expect(input).toHaveValue('plan');
  });

  it('brings the rail in hidden but live as the explorer starts leaving', () => {
    useAppStore.setState({ sidebarExpanded: true });
    render(<Sidebar />);
    act(() => useAppStore.getState().collapseSidebar());
    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(faceOf(expand)).toHaveStyle({ opacity: '0' });
    expect(expand.closest('[inert]')).toBeNull();
  });

  it('brings the explorer in hidden but live as the rail starts leaving', () => {
    render(<Sidebar />);
    act(() => useAppStore.getState().expandSidebar());
    const tree = screen.getByRole('tree');
    expect(faceOf(tree)).toHaveStyle({ opacity: '0' });
    expect(tree.closest('[inert]')).toBeNull();
  });

  it('draws neither face hidden on the first paint', () => {
    useAppStore.setState({ sidebarExpanded: true });
    render(<Sidebar />);
    expect(faceOf(screen.getByRole('tree'))).not.toHaveStyle({ opacity: '0' });
    cleanup();
    useAppStore.setState({ sidebarExpanded: false });
    render(<Sidebar />);
    expect(faceOf(screen.getByRole('button', { name: 'Expand sidebar' }))).not.toHaveStyle({ opacity: '0' });
  });

  it('returns the explorer live when the sidebar re-expands mid-collapse', () => {
    useAppStore.setState({ sidebarExpanded: true });
    render(<Sidebar />);
    act(() => useAppStore.getState().collapseSidebar());
    act(() => useAppStore.getState().expandSidebar());
    const tree = screen.getByRole('tree');
    expect(tree.closest('[inert]')).toBeNull();
    expect(tree.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand sidebar', hidden: true }).closest('[inert]')).not.toBeNull();
  });

  it('lands the width at once under Reduce Motion but keeps the sequenced fades', () => {
    reducedMotion.value = true;
    useAppStore.setState({ sidebarExpanded: true });
    render(<Sidebar />);
    act(() => useAppStore.getState().collapseSidebar());
    expect(sidebarRenderedWidth.get()).toBe(RAIL_WIDTH);
    expect(faceOf(screen.getByRole('button', { name: 'Expand sidebar' }))).toHaveStyle({ opacity: '0' });
    expect(screen.getByRole('tree', { hidden: true })).toBeInTheDocument();
  });
});
