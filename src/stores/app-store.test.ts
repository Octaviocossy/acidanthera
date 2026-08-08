import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './app-store';

const initialState = useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(initialState, true);
});

describe('focusRegion', () => {
  it('switches to a reachable region', () => {
    useAppStore.getState().focusRegion('sidebar');
    expect(useAppStore.getState().activeRegion).toBe('sidebar');
  });

  it('ignores a region that is not currently reachable', () => {
    // chat is closed by default, so it is not reachable
    useAppStore.getState().focusRegion('chat');
    expect(useAppStore.getState().activeRegion).toBe('viewer');
  });
});

describe('focusNext / focusPrevious', () => {
  it('cycles only over reachable regions, skipping a closed chat', () => {
    // sidebarOpen: true, chatOpen: false -> reachable = [sidebar, viewer]
    useAppStore.getState().focusRegion('sidebar');
    useAppStore.getState().focusNext();
    expect(useAppStore.getState().activeRegion).toBe('viewer');

    useAppStore.getState().focusNext();
    expect(useAppStore.getState().activeRegion).toBe('sidebar');
  });

  it('includes chat once it is opened', () => {
    useAppStore.getState().openChat();
    useAppStore.getState().focusRegion('sidebar');
    useAppStore.getState().focusNext();
    expect(useAppStore.getState().activeRegion).toBe('viewer');
    useAppStore.getState().focusNext();
    expect(useAppStore.getState().activeRegion).toBe('chat');
  });

  it('wraps backward past the first reachable region', () => {
    useAppStore.getState().focusRegion('sidebar');
    useAppStore.getState().focusPrevious();
    expect(useAppStore.getState().activeRegion).toBe('viewer');
  });
});

describe('focusEditor / requestEditorFocus', () => {
  it('focuses the viewer region and raises a focus request', () => {
    useAppStore.getState().focusRegion('sidebar');
    useAppStore.getState().focusEditor();

    expect(useAppStore.getState().activeRegion).toBe('viewer');
    expect(useAppStore.getState().editorFocusRequest).toBe(1);
  });

  it('raises a fresh request even when the viewer is already the active region', () => {
    // The whole reason the request is a counter: re-opening the buffer that is already active
    // changes no other state, yet the file finder's input has just unmounted with DOM focus.
    useAppStore.getState().focusEditor();
    useAppStore.getState().focusEditor();

    expect(useAppStore.getState().editorFocusRequest).toBe(2);
  });

  it('requestEditorFocus raises a request without moving the focused region', () => {
    useAppStore.getState().focusRegion('sidebar');
    useAppStore.getState().requestEditorFocus();

    expect(useAppStore.getState().activeRegion).toBe('sidebar');
    expect(useAppStore.getState().editorFocusRequest).toBe(1);
  });
});

describe('setMode', () => {
  it('sets the global mode', () => {
    useAppStore.getState().setMode('command');
    expect(useAppStore.getState().mode).toBe('command');
  });
});

describe('sidebar visibility', () => {
  it('closeSidebar reassigns activeRegion to viewer when sidebar was active', () => {
    useAppStore.getState().focusRegion('sidebar');
    useAppStore.getState().closeSidebar();
    const state = useAppStore.getState();
    expect(state.sidebarOpen).toBe(false);
    expect(state.activeRegion).toBe('viewer');
  });

  it('closeSidebar leaves an unrelated activeRegion untouched', () => {
    useAppStore.getState().openChat();
    useAppStore.getState().focusRegion('chat');
    useAppStore.getState().closeSidebar();
    expect(useAppStore.getState().activeRegion).toBe('chat');
  });

  it('toggleSidebar flips open -> closed -> open', () => {
    expect(useAppStore.getState().sidebarOpen).toBe(true);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(false);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(true);
  });

  it('a hidden sidebar is unreachable via focusRegion', () => {
    useAppStore.getState().closeSidebar();
    useAppStore.getState().focusRegion('sidebar');
    expect(useAppStore.getState().activeRegion).toBe('viewer');
  });
});

describe('chat visibility', () => {
  it('openChat/closeChat toggle chatOpen', () => {
    useAppStore.getState().openChat();
    expect(useAppStore.getState().chatOpen).toBe(true);
    useAppStore.getState().closeChat();
    expect(useAppStore.getState().chatOpen).toBe(false);
  });

  it('closeChat reassigns activeRegion to viewer when chat was active', () => {
    useAppStore.getState().openChat();
    useAppStore.getState().focusRegion('chat');
    useAppStore.getState().closeChat();
    const state = useAppStore.getState();
    expect(state.chatOpen).toBe(false);
    expect(state.activeRegion).toBe('viewer');
  });

  it('toggleChat flips closed -> open -> closed', () => {
    expect(useAppStore.getState().chatOpen).toBe(false);
    useAppStore.getState().toggleChat();
    expect(useAppStore.getState().chatOpen).toBe(true);
    useAppStore.getState().toggleChat();
    expect(useAppStore.getState().chatOpen).toBe(false);
  });
});

describe('settings overlay', () => {
  it('openSettings/closeSettings/toggleSettings do not touch activeRegion', () => {
    useAppStore.getState().focusRegion('sidebar');
    useAppStore.getState().openSettings();
    expect(useAppStore.getState().settingsOpen).toBe(true);
    expect(useAppStore.getState().activeRegion).toBe('sidebar');

    useAppStore.getState().toggleSettings();
    expect(useAppStore.getState().settingsOpen).toBe(false);

    useAppStore.getState().closeSettings();
    expect(useAppStore.getState().settingsOpen).toBe(false);
  });
});

describe('setVaultRoot', () => {
  it('stores the vault root path', () => {
    useAppStore.getState().setVaultRoot('/some/vault');
    expect(useAppStore.getState().vaultRoot).toBe('/some/vault');
    useAppStore.getState().setVaultRoot(null);
    expect(useAppStore.getState().vaultRoot).toBeNull();
  });
});
