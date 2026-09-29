// Morning / evening runs (mirrors server/src/utils/sessions.js). Which run a
// trip is comes from the clock: before 12:00 noon the MORNING PICK-UP (home to
// school), from noon the AFTERNOON DROP-OFF (school to home).

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

export const sessionLabel = (session) =>
  session === 'morning' ? 'Morning pick-up' : session === 'evening' ? 'Afternoon drop-off' : '';

// Words for the steps of each run, so statuses match what is happening.
const RUN_WORDS = {
  morning: { board: 'Picked up', drop: 'At school', notHere: 'Not at pick-up', waiting: 'Waiting at home' },
  evening: { board: 'On the bus', drop: 'Dropped home', notHere: 'Not on the bus', waiting: 'Waiting at school' },
};
const PLAIN = { board: 'On board', drop: 'Dropped off', notHere: 'Not on board', waiting: 'Pending' };
export const runWords = (session) => RUN_WORDS[session] || PLAIN;

/** A stored drop-off status, worded for the trip's run. */
export function statusLabel(session, status) {
  const w = runWords(session);
  return { 'On board': w.board, 'Dropped off': w.drop, 'Not on board': w.notHere, Pending: w.waiting }[status] || status;
}
