import { create } from 'zustand';

export type ViewType = 'topology' | 'logs' | 'metrics' | 'traces';
export type Theme = 'dark' | 'light' | 'system';

interface UIState {
  activeView: ViewType;
  theme: Theme;
  sidebarCollapsed: boolean;

  setActiveView: (view: ViewType) => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'topology',
  theme: 'dark',
  sidebarCollapsed: false,

  setActiveView: (view) => set({ activeView: view }),
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
