// Nearest first: orders a trip's students by who is next to be picked up
// (morning) or dropped off (afternoon), from the bus's live position and each
// child's home. Distances are straight-line ("as the crow flies").
//
// The same file is used by the driver app (driver/src/lib/nearest.js) and the
// bus assistant page (admin/src/lib/nearest.js): keep them identical.

/** Distance in metres between two { lat, lng } points (haversine). */
export function metresBetween(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 240 -> "240 m", 1830 -> "1.8 km". */
export const formatDistance = (m) => (m == null ? '' : m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);

// Someone further down the list only moves above the one before them when
// they are this much nearer, so the list doesn't keep swapping two children
// who live close together.
export const SWAP_METRES = 50;

const idOf = (p) => String(p.student?._id || p.student || '');
const nameOf = (p) => `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.trim();
const byName = (a, b) => nameOf(a.p).localeCompare(nameOf(b.p));
const notRiding = (p) => p.attendance === 'Absent' || p.attendance === 'Cancelled';
const waiting = (status) => !status || status === 'Pending' || status === 'Boarding now';
const hasHome = (p) => Number.isFinite(p.student?.lat) && Number.isFinite(p.student?.lng);
const validPos = (pos) => pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng);

/**
 * Which part of the list a student belongs in for this run:
 *   'next'   still to be picked up (morning) / dropped off (afternoon): nearest first
 *   'other'  on the bus heading to school (morning) / waiting at school (afternoon)
 *   'done'   picked up and dropped, not here, absent or cancelled
 */
export function groupOf(p, session) {
  if (notRiding(p)) return 'done';
  const status = p.dropoffStatus;
  if (status === 'Dropped off' || status === 'Not on board') return 'done';
  if (session === 'morning') return waiting(status) ? 'next' : 'other';
  if (session === 'evening') return status === 'On board' ? 'next' : 'other';
  return 'next'; // trips from before runs existed
}

/** Section titles, in the order they are shown. */
export function sectionsFor(session) {
  if (session === 'evening') {
    return [
      { key: 'other', title: 'Waiting at school' },
      { key: 'next', title: 'Next to drop off (nearest first)' },
      { key: 'done', title: 'Done' },
    ];
  }
  return [
    { key: 'next', title: session === 'morning' ? 'Next to pick up (nearest first)' : 'Next (nearest first)' },
    { key: 'other', title: 'On the bus' },
    { key: 'done', title: 'Done' },
  ];
}

/**
 * Orders the trip. `bus` is the bus position ({ lat, lng }) or null;
 * `previous` is the last order returned (its `order` ids), which keeps the
 * list steady between updates.
 * Returns { next, other, done, order } where each list holds
 * { p, metres, noHome }.
 */
export function orderTrip({ progress = [], session, bus, previous = [] }) {
  const at = validPos(bus) ? bus : null;
  const groups = { next: [], other: [], done: [] };
  for (const p of progress) {
    const metres = at && hasHome(p) ? metresBetween(at, { lat: p.student.lat, lng: p.student.lng }) : null;
    groups[groupOf(p, session)].push({ p, metres, noHome: !hasHome(p) });
  }

  // Next: children with a home location, nearest first (steadily), then the
  // ones with no home location saved, by name.
  const located = groups.next.filter((r) => !r.noHome);
  const unlocated = groups.next.filter((r) => r.noHome).sort(byName);
  const rank = new Map(previous.map((id, i) => [id, i]));
  located.sort((a, b) => {
    const ra = rank.has(idOf(a.p)) ? rank.get(idOf(a.p)) : Infinity;
    const rb = rank.has(idOf(b.p)) ? rank.get(idOf(b.p)) : Infinity;
    if (ra !== rb) return ra - rb; // keep the last order to start with
    if (a.metres != null && b.metres != null) return a.metres - b.metres;
    return byName(a, b);
  });
  if (at) {
    // Let a child move up past the one ahead only when clearly nearer.
    for (let pass = 0; pass < located.length; pass += 1) {
      let swapped = false;
      for (let i = 1; i < located.length; i += 1) {
        const ahead = located[i - 1];
        const here = located[i];
        const clearlyNearer = rank.size === 0 || !rank.has(idOf(ahead.p)) || !rank.has(idOf(here.p))
          ? here.metres < ahead.metres
          : here.metres + SWAP_METRES < ahead.metres;
        if (clearlyNearer) {
          located[i - 1] = here;
          located[i] = ahead;
          swapped = true;
        }
      }
      if (!swapped) break;
    }
  }
  groups.next = [...located, ...unlocated];
  groups.other.sort(byName);
  groups.done.sort(byName);
  return { ...groups, order: groups.next.map((r) => idOf(r.p)) };
}

/** Does this student match the search words (name, code, class, parent)? */
export function matchesSearch(p, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const s = p.student || {};
  const g = s.primaryGuardian || {};
  const hay = [s.firstName, s.lastName, `${s.firstName || ''} ${s.lastName || ''}`, s.studentCode, s.classGrade, g.firstName, g.lastName, g.phone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}

// ---- Arrival call results (server: services/voice) ----
export const CALL_LABELS = {
  calling: 'Calling parent…',
  ringing: 'Ringing',
  answered: 'Answered',
  cut: 'Call cut',
  declined: 'Declined / busy',
  no_answer: 'Not picked up',
  failed: "Didn't go through",
};
export const CALL_IN_PROGRESS = ['calling', 'ringing'];

/**
 * What to show on a student's card about the near-home alert:
 * { text, tone: 'info' | 'good' | 'bad' | 'plain' } or null.
 */
export function callInfo(p) {
  if (p.callStatus && CALL_LABELS[p.callStatus]) {
    const secs = Number(p.callSeconds);
    let text = `Call: ${CALL_LABELS[p.callStatus]}`;
    if (p.callStatus === 'answered' && Number.isFinite(secs) && secs > 0) text += ` (${Math.round(secs)}s)`;
    if (p.callFallback && p.callFallback !== 'Sending text') text += p.callFallback === 'Sent' ? ' · text sent' : ' · text not sent';
    const tone = CALL_IN_PROGRESS.includes(p.callStatus) ? 'info' : p.callStatus === 'answered' ? 'good' : 'bad';
    return { text, tone };
  }
  if (p.nearHomeAt) return { text: p.nearHomeAlert === 'Sent' ? 'Near home · parent texted' : 'Near home', tone: 'plain' };
  return null;
}
