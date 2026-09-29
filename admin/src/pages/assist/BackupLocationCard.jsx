import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const TEXT = {
  off: 'Off. Turn on to cover the bus location if the driver’s phone loses its connection.',
  waiting: 'On. Starts sharing when the driver starts the trip.',
  starting: 'On · getting your location…',
  standby: 'On · standing by. The driver’s phone is reporting, so the school uses that.',
  using: 'On · your phone is showing the bus location now (the driver’s phone is not reporting).',
  not_on_bus: 'On · your phone seems not to be on the bus (too far from the driver’s), so it is not used.',
  weak_gps: 'On · your location is not precise enough yet. Turn on precise location or move near a window.',
  denied: 'Location is blocked for this page. Allow location for this website in your browser settings, then reload.',
  unavailable: 'This browser can’t share location. Try Chrome or Safari.',
};

const secondsAgo = (t) => Math.max(0, Math.round((Date.now() - t) / 1000));

/** The "Share my location as backup" switch and what it is doing. */
export default function BackupLocationCard({ backup }) {
  const { on, toggle, state, lastSentAt, screenAwake, message } = backup;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [on]);

  const good = state === 'using' || state === 'standby';
  const warn = ['not_on_bus', 'weak_gps', 'denied', 'unavailable', 'error'].includes(state);

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-navy-light">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className={cn('mt-0.5 h-4 w-4 shrink-0', good ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-slate-400')} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Share my location as backup</p>
            <p className={cn('mt-0.5 text-xs', warn ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')}>
              {state === 'error' ? message || 'Could not share your location.' : TEXT[state]}
            </p>
            {on && lastSentAt && (
              <p className="mt-0.5 text-xs text-slate-400">
                Last sent {secondsAgo(lastSentAt)}s ago{screenAwake ? ' · screen kept on' : ''}
              </p>
            )}
            {on && (
              <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Keep this page open with the screen on.</p>
            )}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Share my location as backup"
          onClick={toggle}
          className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}
        >
          <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[1.375rem]' : 'left-0.5')} />
        </button>
      </div>
    </div>
  );
}
