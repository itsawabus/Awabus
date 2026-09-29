import { create } from 'zustand';

// The phone's latest position while a trip is running, shared by the
// background tracker (which sends it) and the screens (which show it).
export const useLiveGpsStore = create((set) => ({
  position: null, // { lat, lng, heading, recordedAt }
  lastSentAt: null,
  error: null,
  // Screen-off tracking (src/lib/backgroundLocation.js):
  // 'off' | 'running' | 'no_permission' | 'failed'
  background: 'off',
  backgroundError: '', // the phone's own reason when it would not start
  setBackground: (background, backgroundError = '') => set({ background, backgroundError }),
  setPosition: (position) => set({ position }),
  setError: (error) => set({ error }),
  markSent: () => set({ lastSentAt: Date.now() }),
  reset: () => set({ position: null, lastSentAt: null, error: null }),
}));
