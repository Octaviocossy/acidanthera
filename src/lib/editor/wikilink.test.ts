import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { invoke } from '@tauri-apps/api/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultEntry } from '@/services/vault.service';
import { useAppStore } from '@/stores/app-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { wikilink } from './wikilink';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

function note(path: string): VaultEntry {
  return { name: path.slice(path.lastIndexOf('/') + 1), path, isDir: false, modified: null, children: null };
}

let view: EditorView | null = null;

function mount(doc: string): EditorView {
  view = new EditorView({ state: EditorState.create({ doc, extensions: [wikilink] }), parent: document.body });
  return view;
}

function decorated(selector: string): HTMLElement[] {
  return Array.from(view?.dom.querySelectorAll<HTMLElement>(selector) ?? []);
}

describe('wikilink', () => {
  afterEach(() => {
    view?.destroy();
    view = null;
  });

  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useSidebarStore.setState({ tree: [note('/vault/Alpha.md')] });
    useEditorStore.setState({ buffers: [], activeBufferId: null, saveRequests: [] });
    useAppStore.setState({ activeRegion: 'sidebar', editorFocusRequest: 0 });
  });

  it('decorates a resolved target as a link carrying the note it opens', () => {
    mount('see [[Alpha]] for more');

    const links = decorated('.cm-wikilink');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('[[Alpha]]');
    expect(links[0].getAttribute('data-wikilink-path')).toBe('/vault/Alpha.md');
  });

  it('decorates a missing target as broken, with no note to open', () => {
    mount('see [[Gamma]] for more');

    expect(decorated('.cm-wikilink')).toHaveLength(0);
    const broken = decorated('.cm-wikilink-broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].getAttribute('title')).toBe('no note with this name');
  });

  it('decorates an ambiguous target as broken rather than picking a match', () => {
    useSidebarStore.setState({ tree: [note('/vault/Alpha.md'), note('/vault/archive/Alpha.md')] });
    mount('see [[Alpha]] for more');

    expect(decorated('.cm-wikilink')).toHaveLength(0);
    expect(decorated('.cm-wikilink-broken')[0].getAttribute('title')).toBe('two notes share this name');
  });

  it('resolves an aliased and anchored target like the read view does', () => {
    mount('see [[Alpha#Intro|the first one]] for more');

    expect(decorated('.cm-wikilink')[0].getAttribute('data-wikilink-path')).toBe('/vault/Alpha.md');
  });

  it('opens the note when a resolved span is clicked', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('# Alpha');
    mount('see [[Alpha]] for more');

    decorated('.cm-wikilink')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(useEditorStore.getState().buffers).toHaveLength(1));

    expect(invoke).toHaveBeenCalledWith('read_note', { path: '/vault/Alpha.md' });
  });

  it('does nothing when a broken span is clicked', async () => {
    mount('see [[Gamma]] for more');

    decorated('.cm-wikilink-broken')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(invoke).not.toHaveBeenCalled();
  });

  it('re-resolves when the vault tree changes, so a link stops reading broken with no keystroke', async () => {
    mount('see [[Beta]] for more');
    expect(decorated('.cm-wikilink-broken')).toHaveLength(1);

    useSidebarStore.setState({ tree: [note('/vault/Alpha.md'), note('/vault/Beta.md')] });

    await vi.waitFor(() => expect(decorated('.cm-wikilink')).toHaveLength(1));
    expect(decorated('.cm-wikilink-broken')).toHaveLength(0);
  });
});
