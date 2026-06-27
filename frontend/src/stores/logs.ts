import { create } from 'zustand';

export interface LogLine {
  timestamp: string;
  container: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  message: string;
}

interface LogState {
  lines: LogLine[];
  searchQuery: string;
  levelFilter: Set<string>;
  isPinned: boolean;
  maxLines: number;

  appendLines: (lines: LogLine[]) => void;
  setSearchQuery: (query: string) => void;
  toggleLevelFilter: (level: string) => void;
  setPinned: (pinned: boolean) => void;
  clear: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  lines: [],
  searchQuery: '',
  levelFilter: new Set(['error', 'warn', 'info', 'debug']),
  isPinned: true,
  maxLines: 1_000_000,

  appendLines: (newLines) =>
    set((state) => {
      const combined = [...state.lines, ...newLines];
      // Enforce max buffer size
      const lines =
        combined.length > state.maxLines
          ? combined.slice(combined.length - state.maxLines)
          : combined;
      return { lines };
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleLevelFilter: (level) =>
    set((state) => {
      const next = new Set(state.levelFilter);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return { levelFilter: next };
    }),

  setPinned: (pinned) => set({ isPinned: pinned }),

  clear: () => set({ lines: [], searchQuery: '' }),
}));
