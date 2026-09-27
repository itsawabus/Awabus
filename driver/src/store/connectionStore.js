import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

// Shared connectivity state: whether the device thinks it's online, and when
// we last successfully reached the server (used for "Last sync: Xs ago").
export const useConnectionStore = create((set) => ({
  isOnline: true,
  lastSyncAt: null,
  setOnline: (isOnline) => set({ isOnline }),
  markSynced: () => set({ lastSyncAt: Date.now(), isOnline: true }),
}));

NetInfo.addEventListener((state) => {
  const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
  useConnectionStore.getState().setOnline(isOnline);
});
