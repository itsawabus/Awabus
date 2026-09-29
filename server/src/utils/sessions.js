// Morning and evening runs.
//
// Each route has an estimated start time for its morning run and its evening
// run (set by the school). They decide which run a trip belongs to. (They are
// not a cut-off for parents: a cancelled ride always applies to the next run
// that has not started, see services/rideCancellations.js.) Each student rides in the morning,
// the evening, or both; a trip only lists the students riding that run.

export const RIDE_SESSIONS = ['both', 'morning', 'evening'];
export const RIDE_SESSION_LABELS = { both: 'Morning & evening', morning: 'Morning only', evening: 'Evening only' };
export const DEFAULT_RIDE_SESSION = 'both';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Reads a time of day as "HH:MM" (24-hour). Accepts "6:00", "06:00", "6:00 AM",
 * "3:30 pm", "15:30", an Excel time (fraction of a day) or a Date.
 * Returns "HH:MM", '' for an empty value, or null when it can't be read.
 */
export function parseTime(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  if (typeof value === 'number') {
    if (value < 0 || value >= 1) return null;
    const minutes = Math.round(value * 24 * 60);
    return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  }
  const m = String(value).trim().match(/^(\d{1,2})[:.](\d{2})\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.[0]?.toLowerCase();
  if (min > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'p' && h !== 12) h += 12;
    if (ampm === 'a' && h === 12) h = 0;
  } else if (h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

/** "06:30" -> "6:30 AM" for messages. */
export const formatTime12 = (hhmm) => {
  if (!hhmm) return '';
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${pad(mins % 60)} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * Checks a route's two start times. Returns { morningStartTime, eveningStartTime }
 * ("HH:MM" or '') or { error }.
 */
export function cleanRouteTimes({ morningStartTime, eveningStartTime }, existing = {}) {
  const morning = morningStartTime === undefined ? existing.morningStartTime || '' : parseTime(morningStartTime);
  const evening = eveningStartTime === undefined ? existing.eveningStartTime || '' : parseTime(eveningStartTime);
  if (morning === null) return { error: 'Enter the morning start time as a time of day, e.g. 06:00' };
  if (evening === null) return { error: 'Enter the evening start time as a time of day, e.g. 15:00' };
  if (morning && toMinutes(morning) >= 12 * 60) return { error: 'The morning start time must be before 12:00 noon' };
  if (evening && toMinutes(evening) < 12 * 60) return { error: 'The evening start time must be 12:00 noon or later' };
  return { morningStartTime: morning, eveningStartTime: evening };
}

export function normalizeRideSession(value) {
  if (value == null || value === '') return undefined;
  const v = String(value).trim().toLowerCase();
  if (RIDE_SESSIONS.includes(v)) return v;
  const byLabel = Object.entries(RIDE_SESSION_LABELS).find(([, label]) => label.toLowerCase() === v);
  return byLabel ? byLabel[0] : null;
}

/**
 * Which run a trip starting now belongs to. The day is split half-way between
 * the route's morning and evening start times (noon when they are not set).
 */
export function sessionFor(route, now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes();
  const morning = route?.morningStartTime ? toMinutes(route.morningStartTime) : null;
  const evening = route?.eveningStartTime ? toMinutes(route.eveningStartTime) : null;
  let split = 12 * 60;
  if (morning != null && evening != null) split = Math.round((morning + evening) / 2);
  return current < split ? 'morning' : 'evening';
}

/** Does a student riding `rideSession` belong on a `session` trip? */
export const ridesIn = (rideSession, session) => !session || !rideSession || rideSession === 'both' || rideSession === session;
