// Morning / evening runs (mirrors server/src/utils/sessions.js).

export const RIDE_SESSIONS = [
  { value: 'both', label: 'Morning & evening' },
  { value: 'morning', label: 'Morning only' },
  { value: 'evening', label: 'Evening only' },
];
export const DEFAULT_RIDE_SESSION = 'both';
export const rideSessionLabel = (value) => RIDE_SESSIONS.find((s) => s.value === value)?.label || 'Morning & evening';

/** "06:30" -> "6:30 AM"; '' -> "Not set". */
export function formatRunTime(hhmm, empty = 'Not set') {
  if (!hhmm) return empty;
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const sessionLabel = (session) => (session === 'morning' ? 'Morning run' : session === 'evening' ? 'Evening run' : '');
