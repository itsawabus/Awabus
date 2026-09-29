// Words for each run, so buttons and statuses match what the bus is doing.
// The server decides the run from the clock (server/src/utils/sessions.js):
// before 12:00 noon the MORNING PICK-UP (home to school), from noon the
// AFTERNOON DROP-OFF (school to home).
const WORDS = {
  morning: {
    name: 'Morning pick-up',
    short: 'pick-up',
    board: 'Picked up', // button and status for "On board"
    boardVerb: 'picked up',
    drop: 'At school', // button and status for "Dropped off"
    dropVerb: 'arrived at school',
    dropCount: 'at school',
    notHere: 'Not at pick-up',
    waiting: 'Waiting at home',
    onBus: 'on the bus',
  },
  evening: {
    name: 'Afternoon drop-off',
    short: 'drop-off',
    board: 'On the bus',
    boardVerb: 'on the bus',
    drop: 'Dropped home',
    dropVerb: 'dropped at home',
    dropCount: 'dropped home',
    notHere: 'Not on the bus',
    waiting: 'Waiting at school',
    onBus: 'on the bus',
  },
};

// Trips from before runs existed have no session: plain words.
const PLAIN = {
  name: 'Trip',
  short: 'trip',
  board: 'On board',
  boardVerb: 'boarded',
  drop: 'Dropped off',
  dropVerb: 'dropped off',
  dropCount: 'dropped off',
  notHere: 'Not here',
  waiting: 'Waiting',
  onBus: 'on board',
};

export const runWords = (session) => WORDS[session] || PLAIN;

/** The label for a stored drop-off status on a trip of this run. */
export const statusLabel = (session, status) => {
  const w = runWords(session);
  if (status === 'On board') return w.board;
  if (status === 'Dropped off') return w.drop;
  if (status === 'Not on board') return w.notHere;
  if (status === 'Pending') return w.waiting;
  return status;
};

/**
 * Is this child still waiting on the run, so a delay affects them?
 * Morning pick-up: only children still to be picked up (not those already
 * on the bus or at school). Afternoon drop-off: children not yet dropped
 * home (at school or on the bus). Never absent, cancelled or "not here".
 */
export function delayAffects(row, session) {
  if (!row || row.attendance === 'Absent' || row.attendance === 'Cancelled') return false;
  const status = row.dropoffStatus || 'Pending';
  if (status === 'Not on board' || status === 'Dropped off') return false;
  if (session === 'morning') return status === 'Pending' || status === 'Boarding now';
  return true;
}
