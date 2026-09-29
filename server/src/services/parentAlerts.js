// Text alerts to parents when their child boards or is dropped off, and when
// the bus comes near home. Off unless PARENT_ALERTS=true, because every alert
// is a paid SMS; until then each scan records "Not sent (alerts are off)"
// instead of claiming an alert went out.
import Student from '../models/Student.js';
import Bus from '../models/Bus.js';
import Trip from '../models/Trip.js';
import { sendSms } from './messaging/index.js';
import { runWords } from '../utils/sessions.js';

export const parentAlertsEnabled = () => process.env.PARENT_ALERTS === 'true';

// What the admin sees in the trip's "Alert" column.
export const ALERT_STATUS = {
  off: 'Not sent (alerts are off)',
  noPhone: 'Not sent (no parent phone)',
  sent: 'Sent',
  logged: 'Not sent (no SMS provider)',
  failed: 'Failed',
  callsOff: 'Not called (arrival calls are off for this student)',
  sibling: 'Not called (parent already called for a brother or sister)',
};

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });

// Scans that tell the parent something, worded for the run: in the morning
// the child is picked up at home and arrives at school; in the afternoon the
// child gets on at school and is dropped off at home.
const SCAN_TEXT = {
  'On board': (name, plate, time, session) =>
    `AwaBus: ${name} ${runWords(session).boarded}${plate ? ` (bus ${plate})` : ''} at ${time}.`,
  'Dropped off': (name, plate, time, session) =>
    `AwaBus: ${name} ${runWords(session).dropped}${plate ? ` (bus ${plate})` : ''} at ${time}.`,
};

const loadStudent = (id) =>
  Student.findById(id).select('firstName primaryGuardian lat lng geofenceRadius').populate('primaryGuardian', 'phone preferredLanguage').lean();

async function deliver(to, text, purpose, school) {
  if (!to) return ALERT_STATUS.noPhone;
  const res = await sendSms({ to, text, purpose, school });
  if (res.status === 'sent') return ALERT_STATUS.sent;
  if (res.status === 'logged') return ALERT_STATUS.logged;
  return ALERT_STATUS.failed;
}

/**
 * After a boarding / drop-off scan. Returns { alertStatus, alertTime, alertFor }
 * for the student's row, or null when this scan sends nothing (other statuses,
 * or the same alert already went out for this trip).
 */
export async function alertForScan({ trip, row, dropoffStatus, school }) {
  const makeText = SCAN_TEXT[dropoffStatus];
  if (!makeText) return null;
  if (row.alertFor === dropoffStatus && row.alertStatus === ALERT_STATUS.sent) return null; // sent before (e.g. repeated scan)
  const alertTime = timeNow();
  if (!parentAlertsEnabled()) return { alertStatus: ALERT_STATUS.off, alertTime, alertFor: dropoffStatus };

  const [student, bus] = await Promise.all([loadStudent(row.student), trip.bus ? Bus.findById(trip.bus).select('plateNumber').lean() : null]);
  const text = makeText(student?.firstName || 'Your child', bus?.plateNumber, alertTime, trip.session);
  const alertStatus = await deliver(student?.primaryGuardian?.phone, text, 'boarding_alert', school);
  return { alertStatus, alertTime, alertFor: dropoffStatus };
}

// Distance in metres between two points (haversine).
export function metresBetween(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Geofence check for a new bus position: every student still waiting for the
 * bus (not yet picked up) or still on it (not yet dropped off) whose home is
 * within their notification zone gets marked "near home" once per trip, and
 * their parent is contacted when alerts are on: unless arrival calls are off
 * for that student, and at most once per trip for a parent or a shared home
 * (brothers and sisters). Runs after the position is saved;
 * problems are logged, never passed to the driver.
 */
export async function checkGeofences({ tripId, position, school }) {
  try {
    const trip = await Trip.findById(tripId).select('studentProgress bus status session').lean();
    if (!trip) return 0;
    // Morning pick-up: only children still waiting at home (the bus is coming
    // for them). Afternoon drop-off: only children on the bus (it is taking
    // them home). A child already picked up is never "near home" in the morning.
    const due = trip.session === 'morning' ? ['Pending', 'Boarding now'] : trip.session === 'evening' ? ['On board'] : ['Pending', 'On board', 'Boarding now'];
    const waiting = trip.studentProgress
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.nearHomeAt && ['Present', 'Expected'].includes(row.attendance) && due.includes(row.dropoffStatus));
    if (!waiting.length) return 0;

    // Everyone on the trip, so parents already called on it (for a brother or
    // sister) can be recognised.
    const students = await Student.find({ _id: { $in: trip.studentProgress.map((row) => row.student) } })
      .select('firstName lat lng geofenceRadius primaryGuardian household arrivalCalls')
      .populate('primaryGuardian', 'phone')
      .lean();
    const byId = new Map(students.map((s) => [String(s._id), s]));
    // A student's family on this trip: their parent and their shared home.
    const familyOf = (studentId) => {
      const s = byId.get(String(studentId));
      if (!s) return [];
      return [s.primaryGuardian && `parent:${s.primaryGuardian._id}`, s.household && `home:${s.household}`].filter(Boolean);
    };
    // Families this trip already tried to reach: one call per family per trip.
    const calledFamilies = new Set(
      trip.studentProgress
        .filter((row) => row.nearHomeAlert && ![ALERT_STATUS.off, ALERT_STATUS.callsOff, ALERT_STATUS.sibling].includes(row.nearHomeAlert))
        .flatMap((row) => familyOf(row.student))
    );
    let entered = 0;
    for (const { row, index } of waiting) {
      const s = byId.get(String(row.student));
      if (!s || !Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
      const radius = s.geofenceRadius > 0 ? s.geofenceRadius : 200;
      if (metresBetween(position, { lat: s.lat, lng: s.lng }) > radius) continue;

      const at = `studentProgress.${index}`;
      // Claim the row first, so two positions arriving together send one SMS.
      // eslint-disable-next-line no-await-in-loop
      const claimed = await Trip.updateOne(
        { _id: tripId, [`${at}.student`]: row.student, [`${at}.nearHomeAt`]: null },
        { $set: { [`${at}.nearHomeAt`]: new Date() } }
      );
      if (!claimed.modifiedCount) continue;
      entered += 1;
      const family = familyOf(row.student);
      let status = ALERT_STATUS.off;
      if (s.arrivalCalls === false) {
        status = ALERT_STATUS.callsOff; // switched off for this student
      } else if (!parentAlertsEnabled()) {
        status = ALERT_STATUS.off;
      } else if (family.some((key) => calledFamilies.has(key))) {
        status = ALERT_STATUS.sibling; // this parent / home was already called on this trip
      } else {
        family.forEach((key) => calledFamilies.add(key));
        const what = trip.session ? runWords(trip.session).near : row.dropoffStatus === 'On board' ? runWords('evening').near : runWords('morning').near;
        // eslint-disable-next-line no-await-in-loop
        status = await deliver(s.primaryGuardian?.phone, `AwaBus: ${s.firstName} ${what}.`, 'approaching_alert', school);
      }
      // eslint-disable-next-line no-await-in-loop
      await Trip.updateOne({ _id: tripId, [`${at}.student`]: row.student }, { $set: { [`${at}.nearHomeAlert`]: status } });
    }
    return entered;
  } catch (err) {
    console.error('[parentAlerts] geofence check failed:', err.message);
    return 0;
  }
}
