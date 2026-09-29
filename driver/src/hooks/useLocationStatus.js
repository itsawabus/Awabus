import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useLocationStatusStore } from '../store/locationStatusStore.js';
import { useLiveGpsStore } from '../store/liveGpsStore.js';

const CHECK_EVERY_MS = 20000;
// A reading this recent counts as "location being read".
const READING_FRESH_MS = 2 * 60 * 1000;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function checkLocation() {
  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!enabled) return 'off';

  let perm = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (perm && perm.status === 'undetermined' && perm.canAskAgain !== false) {
    perm = await Location.requestForegroundPermissionsAsync().catch(() => perm);
  }
  if (!perm || perm.status !== 'granted') return 'denied';

  // During a trip the tracker already reads positions: a recent one is enough.
  const tripFix = useLiveGpsStore.getState().position;
  if (tripFix && Date.now() - new Date(tripFix.recordedAt || 0).getTime() < READING_FRESH_MS) return 'on';

  // Otherwise take one reading to prove location is really working.
  try {
    await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15000);
    return 'on';
  } catch {
    const last = await Location.getLastKnownPositionAsync({ maxAge: READING_FRESH_MS }).catch(() => null);
    return last ? 'on' : 'off';
  }
}

/**
 * Keeps useLocationStatusStore up to date while the driver is signed in:
 * every 20 seconds, and straight away when the app comes back to the front
 * (the driver may have just switched location on or off). `onChange` runs
 * when the state changes, so the school can hear about it quickly.
 */
export function useLocationStatus(onChange) {
  const busy = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let stopped = false;
    const run = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        const state = await checkLocation();
        if (stopped) return;
        const before = useLocationStatusStore.getState().state;
        useLocationStatusStore.getState().setState(state);
        if (state !== before) onChangeRef.current?.(state, before);
      } finally {
        busy.current = false;
      }
    };
    run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}

export default useLocationStatus;
