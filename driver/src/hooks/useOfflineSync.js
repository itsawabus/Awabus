import { useCallback, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineQueueStore } from '../store/offlineQueueStore.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { markAttendance, pushLocation } from '../api/driverApp.js';

// Replays queued scan/attendance/location actions once connectivity returns.
// Mounted once near the app root so it keeps working across screen changes.
export function useOfflineSync() {
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const { queue, remove } = useOfflineQueueStore.getState();
      for (const item of [...queue]) {
        try {
          if (item.kind === 'scan') {
            // eslint-disable-next-line no-await-in-loop
            await markAttendance(item.tripId, item.studentId, item.payload);
          } else if (item.kind === 'location') {
            // eslint-disable-next-line no-await-in-loop
            await pushLocation(item.tripId, item.payload);
          }
          remove(item.id);
          useConnectionStore.getState().markSynced();
        } catch {
          // Still failing (server down, or genuinely still offline) — leave
          // it queued and stop; we'll retry the whole queue next time.
          break;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) flush();
    });
    return unsubscribe;
  }, [flush]);

  return { flush };
}

export default useOfflineSync;
