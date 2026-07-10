import { create } from 'zustand';

/** A focusable region of the app shell (doc/v0-spec.md §3.4, §5.0). */
export type FocusRegion = 'sidebar' | 'viewer' | 'chat';

/** The app-level global vim mode — distinct from the editor's own vim mode (doc/v0-spec.md §3.4). */
export type GlobalMode = 'normal' | 'command';

const REGION_ORDER: FocusRegion[] = ['sidebar', 'viewer', 'chat'];

/**
 * The regions the focus state machine can reach right now. A hidden sidebar (#38) and a closed
 * chat are both unreachable, so `Ctrl-w h`/`l` skip over them. `viewer` is always reachable,
 * which is what guarantees the returned list is never empty.
 */
function reachableRegions({ sidebarOpen, chatOpen }: Pick<AppState, 'sidebarOpen' | 'chatOpen'>): FocusRegion[] {
  return REGION_ORDER.filter((region) => {
    if (region === 'sidebar') return sidebarOpen;
    if (region === 'chat') return chatOpen;
    return true;
  });
}

interface AppState {
  activeRegion: FocusRegion;
  mode: GlobalMode;
  /** Whether the sidebar region is shown (#38). Unlike `settingsOpen` this gates a `FocusRegion`. */
  sidebarOpen: boolean;
  chatOpen: boolean;
  /** Whether the settings dialog overlay is up (#29). An overlay, not a `FocusRegion`. */
  settingsOpen: boolean;
  /** Root path of the open vault. Seeded here (not the filesystem slice) so the chat's
   *  agent `cwd` doesn't depend on the sidebar slice (see epic plan's architecture invariant). */
  vaultRoot: string | null;

  focusRegion: (region: FocusRegion) => void;
  focusNext: () => void;
  focusPrevious: () => void;
  setMode: (mode: GlobalMode) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
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
  mode: 'normal',
  sidebarOpen: true,
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

  setMode: (mode) => set({ mode }),

  openSidebar: () => set({ sidebarOpen: true }),

  closeSidebar: () =>
    set((state) => ({
      sidebarOpen: false,
      activeRegion: state.activeRegion === 'sidebar' ? 'viewer' : state.activeRegion,
    })),

  toggleSidebar: () => (get().sidebarOpen ? get().closeSidebar() : get().openSidebar()),

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
