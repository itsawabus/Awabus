import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineQueueStore } from '../store/offlineQueueStore.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useAuthStore } from '../store/authStore.js';
import { markAttendance, pushLocation } from '../api/driverApp.js';

const RETRY_EVERY_MS = 30 * 1000;

// "Try again later" failures: no connection, server trouble, signed out, rate limited.
const isTemporary = (err) => err?.isNetworkError || !err?.status || err.status >= 500 || err.status === 401 || err.status === 403 || err.status === 408 || err.status === 429;

let flushing = false;

// Sends queued scan/location actions to the server, oldest first.
// An item the server rejects for good (e.g. the trip was already ended) is
// dropped, so it can never block the items behind it. Returns what happened.
export async function flushOfflineQueue() {
  const result = { sent: 0, dropped: 0, left: 0 };
  if (flushing) return result;
  const { token, driver } = useAuthStore.getState();
  if (!token) return result; // signed out: keep the queue for when the driver signs back in
  flushing = true;
  try {
    const { queue, remove } = useOfflineQueueStore.getState();
    for (const item of [...queue]) {
      // Left over from a different driver on this phone: not ours to send.
      if (item.driverId && driver?.id && item.driverId !== driver.id) {
        remove(item.id);
        result.dropped += 1;
        continue;
      }
      try {
        if (item.kind === 'scan') {
          // eslint-disable-next-line no-await-in-loop
          await markAttendance(item.tripId, item.studentId, item.payload);
        } else if (item.kind === 'location') {
          // eslint-disable-next-line no-await-in-loop
          await pushLocation(item.tripId, item.payload);
        }
        remove(item.id);
        result.sent += 1;
        useConnectionStore.getState().markSynced();
      } catch (err) {
        if (isTemporary(err)) break; // leave it queued and retry the whole queue later
        remove(item.id); // the server will never accept it; don't let it block the rest
        result.dropped += 1;
      }
    }
  } finally {
    flushing = false;
    result.left = useOfflineQueueStore.getState().queue.length;
  }
  return result;
}

// Mounted once near the app root so the queue keeps being sent across screens.
export function useOfflineSync() {
  const flush = useCallback(() => flushOfflineQueue(), []);

  useEffect(() => {
    // When the connection comes back...
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) flush();
    });
    // ...when the app comes back to the foreground...
    const appState = AppState.addEventListener('change', (s) => s === 'active' && flush());
    // ...and every 30 seconds while anything is waiting (e.g. the server was down).
    const timer = setInterval(() => {
      if (useOfflineQueueStore.getState().queue.length) flush();
    }, RETRY_EVERY_MS);
    return () => {
      unsubscribe();
      appState.remove();
      clearInterval(timer);
    };
  }, [flush]);

  return { flush };
}

export default useOfflineSync;
