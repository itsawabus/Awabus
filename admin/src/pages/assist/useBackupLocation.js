import { useCallback, useEffect, useRef, useState } from 'react';

// The bus assistant's phone as a backup bus position. While switched on (and
// the trip runs) the browser's location goes to the school every few seconds;
// the server only uses it while the driver's phone is not reporting
// (server/src/services/busPosition.js). Browsers only share location while
// this page is open with the screen on, so the screen is kept awake.

const SEND_EVERY_MS = 8000;
const RESEND_EVERY_MS = 20000; // parked bus: the same position again, so the backup stays live
const FIX_TRUSTED_MS = 2 * 60 * 1000;

const storeKey = (pass) => `awabus.assist.backup.${String(pass).slice(0, 12)}`;
const readOn = (pass) => {
  try {
    return localStorage.getItem(storeKey(pass)) === 'on';
  } catch {
    return false;
  }
};
const writeOn = (pass, on) => {
  try {
    if (on) localStorage.setItem(storeKey(pass), 'on');
    else localStorage.removeItem(storeKey(pass));
  } catch {
    /* not remembered: fine */
  }
};

/**
 * Returns { on, toggle, state, lastSentAt, position, screenAwake, message }.
 * state: 'off' | 'waiting' (trip not running) | 'starting' | 'standby' |
 *        'using' | 'not_on_bus' | 'weak_gps' | 'denied' | 'unavailable' | 'error'
 */
export default function useBackupLocation(api, pass, live) {
  const [on, setOn] = useState(() => readOn(pass));
  const [state, setState] = useState('off');
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState(null);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [screenAwake, setScreenAwake] = useState(false);
  const lastSend = useRef(0);
  const latest = useRef(null);
  const sending = useRef(false);

  const toggle = useCallback(() => {
    setOn((was) => {
      writeOn(pass, !was);
      return !was;
    });
  }, [pass]);

  const send = useCallback(
    async (pos) => {
      if (sending.current) return;
      sending.current = true;
      lastSend.current = Date.now();
      try {
        const res = await api.post('/assist/location', pos);
        const { used, reason } = res.data.data || {};
        setLastSentAt(Date.now());
        setMessage('');
        setState(used ? 'using' : reason === 'not_on_bus' ? 'not_on_bus' : reason === 'weak_gps' ? 'weak_gps' : 'standby');
      } catch (err) {
        if (err.status === 409) setState('waiting');
        else {
          setState('error');
          setMessage(err.message);
        }
      } finally {
        sending.current = false;
      }
    },
    [api]
  );

  // Watch the location while switched on and the trip runs.
  useEffect(() => {
    if (!on) {
      setState('off');
      return undefined;
    }
    if (!live) {
      setState('waiting');
      return undefined;
    }
    if (!('geolocation' in navigator)) {
      setState('unavailable');
      return undefined;
    }
    setState((s) => (['standby', 'using', 'not_on_bus', 'weak_gps'].includes(s) ? s : 'starting'));
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          heading: Number.isFinite(p.coords.heading) ? p.coords.heading : undefined,
          accuracy: Math.round(p.coords.accuracy || 0),
          at: p.timestamp || Date.now(),
        };
        latest.current = pos;
        setPosition(pos);
        if (Date.now() - lastSend.current >= SEND_EVERY_MS) send(pos);
      },
      (err) => {
        if (err.code === 1) setState('denied');
        else {
          setState('error');
          setMessage(err.code === 3 ? 'Still looking for your location…' : err.message || 'Could not read your location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    const timer = setInterval(() => {
      const pos = latest.current;
      if (pos && Date.now() - pos.at < FIX_TRUSTED_MS && Date.now() - lastSend.current >= RESEND_EVERY_MS) send(pos);
    }, 5000);
    return () => {
      navigator.geolocation.clearWatch(watch);
      clearInterval(timer);
    };
  }, [on, live, send]);

  // Keep the screen on while sharing (browsers stop location when it sleeps).
  useEffect(() => {
    if (!on || !live || !navigator.wakeLock?.request) {
      setScreenAwake(false);
      return undefined;
    }
    let lock = null;
    let stopped = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (stopped) {
          lock.release().catch(() => {});
          return;
        }
        setScreenAwake(true);
        lock.addEventListener('release', () => setScreenAwake(false));
      } catch {
        setScreenAwake(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [on, live]);

  return { on, toggle, state, lastSentAt, position, screenAwake, message };
}
