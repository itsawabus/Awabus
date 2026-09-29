import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'awabus_driver_offline_queue';
const MAX_ITEMS = 300;

const persist = (queue) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

// Holds actions that failed to reach the server while offline (a scan, an
// attendance toggle, a GPS ping) so they can be replayed once connectivity
// returns, matching the "Data will sync when you reconnect" promise in the
// design. Each item: { id, kind: 'scan' | 'location', tripId, studentId?, driverId, payload, createdAt }.
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
    let next = get().queue.filter((q) => {
      // Only the latest position matters (the server keeps the bus's current
      // location), so a new one replaces any queued position for this trip.
      if (item.kind === 'location') return !(q.kind === 'location' && q.tripId === item.tripId);
      // Likewise only a student's latest status (e.g. Dropped off after On board).
      if (item.kind === 'scan') return !(q.kind === 'scan' && q.tripId === item.tripId && q.studentId === item.studentId);
      return true;
    });
    next.push(entry);
    // Never grow without limit: drop the oldest items beyond the cap.
    if (next.length > MAX_ITEMS) next = next.slice(next.length - MAX_ITEMS);
    persist(next);
    set({ queue: next });
    return entry.id;
  },

  // A newer step for a student replaces any older one still waiting, so an old
  // queued "On board" can never be sent after (and overwrite) "Dropped off".
  dropScansFor: (tripId, studentId) => {
    const next = get().queue.filter((q) => !(q.kind === 'scan' && q.tripId === tripId && q.studentId === studentId));
    if (next.length === get().queue.length) return;
    persist(next);
    set({ queue: next });
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
