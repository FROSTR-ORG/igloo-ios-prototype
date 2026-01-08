import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { LogStoreState, LogEntry, LogLevel, LogCategory, LogFilter } from '@/types';

const DEFAULT_MAX_ENTRIES = 500;

const DEFAULT_FILTER: LogFilter = {
  levels: ['debug', 'info', 'warn', 'error'],
  categories: ['signing', 'relay', 'peer', 'echo', 'system'],
};

export const useLogStore = create<LogStoreState>()((set, get) => ({
  // State (in-memory only - not persisted)
  entries: [],
  maxEntries: DEFAULT_MAX_ENTRIES,
  filter: DEFAULT_FILTER,
  autoScroll: true,

  // Actions
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    set((state) => {
      const newEntry: LogEntry = {
        ...entry,
        id: nanoid(),
        timestamp: new Date().toISOString(),
      };

      // Prepend new entry and enforce max limit (rolling buffer)
      let entries = [newEntry, ...state.entries];
      if (entries.length > state.maxEntries) {
        entries = entries.slice(0, state.maxEntries);
      }

      return { entries };
    });
  },

  clearLogs: () => {
    set({ entries: [] });
  },

  setFilter: (filter: Partial<LogFilter>) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  setMaxEntries: (max: number) => {
    set((state) => {
      const entries = state.entries.slice(0, max);
      return { maxEntries: max, entries };
    });
  },

  setAutoScroll: (enabled: boolean) => {
    set({ autoScroll: enabled });
  },
}));

/**
 * Get filtered log entries
 */
export function getFilteredLogs(state: LogStoreState): LogEntry[] {
  return state.entries.filter(
    (entry) =>
      state.filter.levels.includes(entry.level) &&
      state.filter.categories.includes(entry.category)
  );
}

/**
 * Helper to check if a log level should be shown
 */
export function isLogLevelEnabled(state: LogStoreState, level: LogLevel): boolean {
  return state.filter.levels.includes(level);
}

/**
 * Helper to check if a log category should be shown
 */
export function isCategoryEnabled(state: LogStoreState, category: LogCategory): boolean {
  return state.filter.categories.includes(category);
}
