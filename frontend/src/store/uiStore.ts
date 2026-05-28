import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  shortcutsHelpOpen: boolean;
  /** True while the user is mid-chord (e.g. pressed G, waiting for the second key). */
  leaderActive: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCollapsed: () => void;
  setCommandOpen: (open: boolean) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setLeaderActive: (active: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  commandOpen: false,
  shortcutsHelpOpen: false,
  leaderActive: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
  setLeaderActive: (active) => set({ leaderActive: active }),
}));
