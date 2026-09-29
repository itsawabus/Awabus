// Cleans up phone GPS before it reaches the map, the trail and the alerts.
//
// A phone standing still does not report one point: indoors or between
// buildings it falls back to Wi-Fi / cell-tower positions that are 50-500 m
// off and jump around. Taken at face value that draws a "trail" through
// buildings and fields and can set off near-home alerts or "At school".
// Each reading is judged against the last position shown:
//   reject  far too rough, or an impossible jump (faster than a bus can go)
//   hold    the change is within the readings' own uncertainty: the bus is
//           standing still, so it stays where it is (only the time moves on)
//   move    a real change: the bus moves (and the trail may grow)
import { metresBetween } from './parentAlerts.js';

export const MAX_ACCURACY_M = 150; // worse than this: not used at all
export const TRUST_ACCURACY_M = 100; // alerts and "At school" only from readings this good
export const TRAIL_ACCURACY_M = 50; // trail dots only from readings this good
export const MIN_STEP_M = 20; // smallest movement that counts
export const MAX_SPEED_MS = 35; // ~126 km/h: anything faster is a GPS jump
const ASSUMED_ACCURACY_M = 25; // older app versions do not send accuracy

const accuracyOf = (p) => (Number.isFinite(p?.accuracy) && p.accuracy > 0 ? p.accuracy : ASSUMED_ACCURACY_M);
const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

// A few rejected "jumps" in a row to the same place mean the bus really is
// there (for example the first position of the trip was the wrong one).
const pendingJumps = new Map(); // trip id -> { lat, lng, count }

/**
 * @param last  the position shown now ({ lat, lng, updatedAt, accuracy }) or null
 * @param fix   the new reading ({ lat, lng, updatedAt, accuracy, speed })
 * @returns { action: 'move' | 'hold' | 'reject', trusted, trail, reason }
 */
export function judgeFix({ tripId, last, fix }) {
  const acc = accuracyOf(fix);
  if (Number.isFinite(fix.accuracy) && fix.accuracy > MAX_ACCURACY_M) {
    return { action: 'reject', trusted: false, trail: false, reason: 'too rough' };
  }
  const trusted = acc <= TRUST_ACCURACY_M;
  if (!valid(last)) return { action: 'move', trusted, trail: acc <= TRAIL_ACCURACY_M, reason: 'first' };

  const distance = metresBetween(last, fix);
  // Phones report accuracy as a radius that holds about 2 times in 3, so a
  // standing phone regularly wanders to twice that: anything inside counts as
  // standing still.
  const noise = Math.max(MIN_STEP_M, 2 * acc + accuracyOf(last));
  const seconds = Math.max(1, (new Date(fix.updatedAt).getTime() - new Date(last.updatedAt).getTime()) / 1000);
  const moving = Number.isFinite(fix.speed) && fix.speed > 2; // the phone itself says it is moving (> 7 km/h)

  if (distance < noise && !moving) {
    pendingJumps.delete(String(tripId));
    return { action: 'hold', trusted, trail: false, reason: 'standing still' };
  }

  // Faster than any bus: a GPS jump, unless the shown position was the rough
  // one (then this better reading corrects it) or the jump keeps repeating.
  const lastWasRough = accuracyOf(last) > 2 * acc && accuracyOf(last) > TRAIL_ACCURACY_M;
  if (distance / seconds > MAX_SPEED_MS && !lastWasRough) {
    const key = String(tripId);
    const pending = pendingJumps.get(key);
    const sameSpot = pending && metresBetween(pending, fix) < Math.max(MIN_STEP_M * 2, acc * 2);
    const count = sameSpot ? pending.count + 1 : 1;
    if (count < 3) {
      pendingJumps.set(key, { lat: fix.lat, lng: fix.lng, count });
      return { action: 'reject', trusted: false, trail: false, reason: 'jump' };
    }
    pendingJumps.delete(key);
    // Confirmed three times: the bus is there, but no trail line across the gap.
    return { action: 'move', trusted, trail: false, reason: 'confirmed jump' };
  }

  pendingJumps.delete(String(tripId));
  return { action: 'move', trusted, trail: acc <= TRAIL_ACCURACY_M, reason: 'moved' };
}

/**
 * Removes GPS spikes from a stored trail when it is drawn (trails saved before
 * this filter, or any leftover): points that would need an impossible speed,
 * and "spikes" that shoot out and straight back.
 */
export function cleanTrail(points = []) {
  const pts = points.filter(valid);
  const kept = [];
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const prev = kept[kept.length - 1];
    if (prev) {
      const d = metresBetween(prev, p);
      const s = Math.max(1, (new Date(p.at).getTime() - new Date(prev.at).getTime()) / 1000);
      if (d < MIN_STEP_M) continue;
      if (d / s > MAX_SPEED_MS) continue;
      const next = pts[i + 1];
      if (next && d > 100 && metresBetween(prev, next) < d / 3) continue; // out and straight back
    }
    kept.push(p);
  }
  return kept;
}
