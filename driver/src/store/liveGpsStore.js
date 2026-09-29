import { create } from 'zustand';

// The phone's latest position while a trip is running, shared by the
// background tracker (which sends it) and the screens (which show it).
export const useLiveGpsStore = create((set) => ({
  position: null, // { lat, lng, heading, recordedAt }
  lastSentAt: null,
  error: null,
  setPosition: (position) => set({ position }),
  setError: (error) => set({ error }),
  markSent: () => set({ lastSentAt: Date.now() }),
  reset: () => set({ position: null, lastSentAt: null, error: null }),
}));
