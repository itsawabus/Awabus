import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

// Watches the device's position while `active` is true. Falls back gracefully
// (returns null coords, sets `error`) when permission is denied or location
// services are off — callers should keep working with the last known
// position instead of crashing.
export function useGeolocation(active) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setError('Location permission was not granted.');
          return;
        }

        subscriptionRef.current = await Location.watchPositionAsync(
          // distanceInterval 0: keep reporting while parked too (every ~5 s on Android).
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
          (loc) => {
            if (cancelled) return;
            setError(null);
            setPosition({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              heading: loc.coords.heading || 0,
              // How far off the reading may be (metres) and how fast the phone
              // moves (m/s): the server uses them to ignore GPS "wander".
              accuracy: Number.isFinite(loc.coords.accuracy) ? Math.round(loc.coords.accuracy) : null,
              speed: Number.isFinite(loc.coords.speed) && loc.coords.speed >= 0 ? loc.coords.speed : null,
              // When the phone took the reading, so a queued one is not shown as current.
              recordedAt: new Date(loc.timestamp || Date.now()).toISOString(),
            });
          }
        );
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [active]);

  return { position, error };
}

export default useGeolocation;
