// How fresh a bus position is, worked out from its timestamp. The server never
// marks a quiet bus as offline on its own, so the admin site judges by age.
export const GPS_STALE_MS = 2 * 60 * 1000; // older than this: "last seen"
export const GPS_LOST_MS = 10 * 60 * 1000; // older than this: treat as no GPS

const ago = (ms) => {
  const s = Math.floor(ms / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min ago`;
  return `${Math.floor(h / 24)} day${h >= 48 ? 's' : ''} ago`;
};

/**
 * state: 'live' | 'stale' | 'lost' | 'none'
 * label: short text for badges; detail: a sentence for the details panel.
 */
export function gpsFreshness(location, now = Date.now()) {
  const t = location?.updatedAt ? new Date(location.updatedAt).getTime() : NaN;
  const hasFix = Number.isFinite(location?.lat) && Number.isFinite(location?.lng);
  if (!hasFix || !Number.isFinite(t)) {
    return { state: 'none', label: 'No position yet', detail: 'The driver app has not sent a position for this trip yet.', ageMs: null };
  }
  const age = Math.max(0, now - t);
  if (age < GPS_STALE_MS) return { state: 'live', label: `Live · ${ago(age)}`, detail: `Position updated ${ago(age)}.`, ageMs: age };
  if (age < GPS_LOST_MS) {
    return { state: 'stale', label: `Last seen ${ago(age)}`, detail: `No new position for ${ago(age).replace(' ago', '')}. The marker shows where the bus was then.`, ageMs: age };
  }
  return {
    state: 'lost',
    label: `No GPS · last seen ${ago(age)}`,
    detail: `The bus has not reported its position for ${ago(age).replace(' ago', '')}. The phone may be off, out of signal, or the app closed. The marker shows the last known position.`,
    ageMs: age,
  };
}

// 5.6037 -> "5.6037° N", -0.187 -> "0.1870° W", 0.47 -> "0.4700° E".
const coord = (value, pos, neg) => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(n)) return '—';
  return `${Math.abs(n).toFixed(4)}° ${n < 0 ? neg : pos}`;
};
export const formatLat = (v) => coord(v, 'N', 'S');
export const formatLng = (v) => coord(v, 'E', 'W');
