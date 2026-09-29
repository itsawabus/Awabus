import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * Keeps the screen on while the calling screen is open. Unlike expo's
 * useKeepAwake it never throws when the screen closes before the phone has
 * switched the "stay awake" on (e.g. the screens are redrawn for a new theme).
 */
export function useStayAwake(tag) {
  useEffect(() => {
    let on = false;
    let closed = false;
    activateKeepAwakeAsync(tag)
      .then(() => {
        on = true;
        if (closed) Promise.resolve(deactivateKeepAwake(tag)).catch(() => {});
      })
      .catch(() => {});
    return () => {
      closed = true;
      if (!on) return;
      try {
        Promise.resolve(deactivateKeepAwake(tag)).catch(() => {});
      } catch {
        // already off
      }
    };
  }, [tag]);
}
