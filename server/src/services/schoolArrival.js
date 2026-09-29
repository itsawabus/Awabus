// "At school" automatically: on the morning pick-up, when the bus reaches the
// school, every child marked picked up is marked at school (as if the driver
// had tapped "At school" for each), and parents get the usual text.
//
// The bus only counts as arriving once it has been well away from the school
// on this trip (twice the arrival radius): a morning bus often sets off from
// the school, and children picked up near it must not be marked straight away.
import Trip from '../models/Trip.js';
import School from '../models/School.js';
import { tenantContext } from '../utils/tenantContext.js';
import { emitToSchool } from '../sockets/rooms.js';
import { alertForScan, metresBetween } from './parentAlerts.js';

const CACHE_MS = 60 * 1000;
const cache = new Map(); // school id -> { at, value }

export const forgetSchoolLocation = (schoolId) => cache.delete(String(schoolId));

async function schoolLocation(schoolId) {
  const key = String(schoolId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const s = await tenantContext.runAsSystem(() => School.findById(schoolId).select('lat lng arrivalRadius autoAtSchool').lean());
  const value =
    s && s.autoAtSchool !== false && Number.isFinite(s.lat) && Number.isFinite(s.lng)
      ? { lat: s.lat, lng: s.lng, radius: s.arrivalRadius > 0 ? s.arrivalRadius : 150 }
      : null;
  cache.set(key, { at: Date.now(), value });
  return value;
}

const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });

/** After each new bus position. Returns how many children were marked at school. */
export async function checkSchoolArrival({ tripId, position, school, io }) {
  try {
    const place = await schoolLocation(school);
    if (!place) return 0;
    const trip = await Trip.findById(tripId).select('session status bus studentProgress awayFromSchool').lean();
    if (!trip || trip.session !== 'morning' || !['In Progress', 'Delayed'].includes(trip.status)) return 0;
    const distance = metresBetween(position, place);

    if (!trip.awayFromSchool) {
      if (distance > place.radius * 2) await Trip.updateOne({ _id: tripId }, { $set: { awayFromSchool: true } });
      return 0;
    }
    if (distance > place.radius) return 0;

    // At school: everyone still marked picked up (on the bus).
    const onBus = trip.studentProgress.map((row, index) => ({ row, index })).filter(({ row }) => row.dropoffStatus === 'On board');
    let marked = 0;
    for (const { row, index } of onBus) {
      const at = `studentProgress.${index}`;
      // eslint-disable-next-line no-await-in-loop
      const alert = (await alertForScan({ trip, row, dropoffStatus: 'Dropped off', school })) || {};
      const changes = {
        dropoffStatus: 'Dropped off',
        scannedAt: new Date(),
        scanLat: position.lat,
        scanLng: position.lng,
        autoMarked: true,
        ...alert,
      };
      const $set = Object.fromEntries(Object.entries(changes).map(([k, v]) => [`${at}.${k}`, v]));
      // Only if still "On board" (the driver may have just tapped it themselves).
      // eslint-disable-next-line no-await-in-loop
      const saved = await Trip.updateOne({ _id: tripId, [`${at}.student`]: row.student, [`${at}.dropoffStatus`]: 'On board' }, { $set });
      if (!saved.modifiedCount) continue;
      marked += 1;
      emitToSchool(io, school, 'trip:studentUpdate', { tripId, studentId: row.student, progress: { ...row, ...changes } });
    }
    if (marked) {
      await Trip.updateOne(
        { _id: tripId },
        { $push: { timeline: { time: clock(), title: 'Arrived at school', description: `${marked} student${marked === 1 ? '' : 's'} marked at school automatically.` } } }
      );
    }
    return marked;
  } catch (err) {
    console.error('[schoolArrival] check failed:', err.message);
    return 0;
  }
}
