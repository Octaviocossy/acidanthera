import { create } from 'zustand';

/** A focusable region of the app shell (doc/v0-spec.md §3.4, §5.0). */
export type FocusRegion = 'sidebar' | 'viewer' | 'chat';

/** The app-level global vim mode — distinct from the editor's own vim mode (doc/v0-spec.md §3.4). */
export type GlobalMode = 'normal' | 'command';

const REGION_ORDER: FocusRegion[] = ['sidebar', 'viewer', 'chat'];

/**
 * The regions the focus state machine can reach right now. The sidebar is always visible — it
 * collapses to a 40px rail rather than unmounting — so expansion, not visibility, gates it.
 * A closed chat is genuinely hidden. `viewer` is always reachable, guaranteeing a non-empty list.
 */
function reachableRegions({ sidebarExpanded, chatOpen }: Pick<AppState, 'sidebarExpanded' | 'chatOpen'>): FocusRegion[] {
  return REGION_ORDER.filter((region) => {
    if (region === 'sidebar') return sidebarExpanded;
    if (region === 'chat') return chatOpen;
    return true;
  });
}

interface AppState {
  activeRegion: FocusRegion;
  /**
   * Monotonic "put real DOM focus in the editor" request, consumed by `BufferEditor`'s focus
   * effect. Distinct from `activeRegion` because an open that changes no other state — re-opening
   * the already-active buffer from the file finder — must still re-claim DOM focus from the overlay
   * that just unmounted and took it to `<body>`.
   */
  editorFocusRequest: number;
  mode: GlobalMode;
  /** Whether the sidebar shows its explorer rather than its collapsed rail. */
  sidebarExpanded: boolean;
  chatOpen: boolean;
  /** Whether the settings dialog overlay is up (#29). An overlay, not a `FocusRegion`. */
  settingsOpen: boolean;
  /** Root path of the open vault. Seeded here (not the filesystem slice) so the chat's
   *  agent `cwd` doesn't depend on the sidebar slice (see epic plan's architecture invariant). */
  vaultRoot: string | null;

  focusRegion: (region: FocusRegion) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focusEditor: () => void;
  requestEditorFocus: () => void;
  setMode: (mode: GlobalMode) => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
  toggleSidebar: () => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  setVaultRoot: (vaultRoot: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeRegion: 'viewer',
  editorFocusRequest: 0,
  mode: 'normal',
  sidebarExpanded: true,
  chatOpen: false,
  settingsOpen: false,
  vaultRoot: null,

  focusRegion: (region) => {
    if (!reachableRegions(get()).includes(region)) return;
    set({ activeRegion: region });
  },

  focusNext: () => {
    const state = get();
    const regions = reachableRegions(state);
    const index = regions.indexOf(state.activeRegion);
    set({ activeRegion: regions[(index + 1) % regions.length] });
  },

  focusPrevious: () => {
    const state = get();
    const regions = reachableRegions(state);
    const index = regions.indexOf(state.activeRegion);
    set({ activeRegion: regions[(index - 1 + regions.length) % regions.length] });
  },

  /** Focuses the viewer region *and* asks the mounted editor for real DOM focus. One `set`, so it
   *  is one render. `'viewer'` is unconditionally reachable (see `reachableRegions`), so unlike
   *  `focusRegion` this needs no guard. */
  focusEditor: () => set((state) => ({ activeRegion: 'viewer', editorFocusRequest: state.editorFocusRequest + 1 })),

  /** Asks the mounted editor for real DOM focus *without* moving the focused region — the editor
   *  claims it only if the viewer is already active. Used when an overlay is dismissed rather than
   *  used (e.g. Escape out of the file finder), which must not drag focus out of another region. */
  requestEditorFocus: () => set((state) => ({ editorFocusRequest: state.editorFocusRequest + 1 })),

  setMode: (mode) => set({ mode }),

  expandSidebar: () => set({ sidebarExpanded: true }),

  collapseSidebar: () =>
    set((state) => ({
      sidebarExpanded: false,
      activeRegion: state.activeRegion === 'sidebar' ? 'viewer' : state.activeRegion,
    })),

  toggleSidebar: () => (get().sidebarExpanded ? get().collapseSidebar() : get().expandSidebar()),

  openChat: () => set({ chatOpen: true }),

  closeChat: () =>
    set((state) => ({
      chatOpen: false,
      activeRegion: state.activeRegion === 'chat' ? 'viewer' : state.activeRegion,
    })),

  toggleChat: () => (get().chatOpen ? get().closeChat() : get().openChat()),

  openSettings: () => set({ settingsOpen: true }),

  closeSettings: () => set({ settingsOpen: false }),

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  setVaultRoot: (vaultRoot) => set({ vaultRoot }),
}));
