import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'awabus_driver_offline_queue';

const persist = (queue) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

// Holds actions that failed to reach the server while offline (a scan, an
// attendance toggle, a GPS ping) so they can be replayed once connectivity
// returns, matching the "Data will sync when you reconnect" promise in the
// design. Each item: { id, kind: 'scan' | 'location', tripId, studentId?, payload, createdAt }.
export const useOfflineQueueStore = create((set, get) => ({
  queue: [],
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      set({ queue: raw ? JSON.parse(raw) : [], isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  enqueue: (item) => {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: Date.now(), ...item };
    const next = [...get().queue, entry];
    persist(next);
    set({ queue: next });
    return entry.id;
  },

  remove: (id) => {
    const next = get().queue.filter((q) => q.id !== id);
    persist(next);
    set({ queue: next });
  },

  clear: () => {
    persist([]);
    set({ queue: [] });
  },
}));
