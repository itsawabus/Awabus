// Parents cancelling a ride, from the AwaBus phone line (IVR) or through the
// school office. There is no cut-off time: a cancellation always applies to
// the NEXT run of that kind that has not started yet.
//
// Phone menu (handleParentKey):
//   1  cancel the morning pick-up
//   2  cancel the afternoon drop-off
//   3  cancel both the pick-up and the drop-off
//   4  put the parent through to the driver
// It covers every child of the calling parent who rides that run. Unknown
// numbers are hung up on.
import RideCancellation from '../models/RideCancellation.js';
import Student from '../models/Student.js';
import Guardian from '../models/Guardian.js';
import Trip from '../models/Trip.js';
import Driver from '../models/Driver.js';
import '../models/Route.js'; // registers Route, used by populate('route') below
import { tenantContext } from '../utils/tenantContext.js';
import { ghanaPhoneVariants } from '../utils/phone.js';
import { ridesIn, sessionFor, toMinutes } from '../utils/sessions.js';

export const RUN_LABELS = { morning: 'morning pick-up', evening: 'afternoon drop-off' };
export const CHOICES = { morning: ['morning'], evening: ['evening'], both: ['morning', 'evening'] };
export const KEY_CHOICES = { 1: 'morning', 2: 'evening', 3: 'both' };

const DAY = 24 * 60 * 60 * 1000;
// Ghana is on UTC all year, so the school day is the UTC date.
export const dateKey = (d) => new Date(d).toISOString().slice(0, 10);
const isWeekend = (key) => [0, 6].includes(new Date(`${key}T12:00:00Z`).getUTCDay());
const nextSchoolDay = (key) => {
  let t = new Date(`${key}T12:00:00Z`).getTime() + DAY;
  while (isWeekend(dateKey(t))) t += DAY;
  return dateKey(t);
};
const dayBounds = (key) => [new Date(`${key}T00:00:00.000Z`), new Date(`${key}T23:59:59.999Z`)];

// Has today's run of this kind started (or finished)?
async function runUnderway(routeId, session, key) {
  const [start, end] = dayBounds(key);
  return Boolean(
    // A trip closed as "not driven" (Cancelled) doesn't count: that run didn't happen.
    await Trip.exists({ route: routeId, session, date: { $gte: start, $lte: end }, status: { $in: ['In Progress', 'Delayed', 'Completed'] } })
  );
}

/**
 * The school day a cancellation of `session` made now applies to: today while
 * that run has not started yet, otherwise the next school day (Mon-Fri).
 */
export async function dayForCancellation(route, session, now = new Date()) {
  const today = dateKey(now);
  if (isWeekend(today)) return nextSchoolDay(today);
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  let passed = await runUnderway(route._id, session, today);
  if (!passed && session === 'morning') passed = sessionFor(route, now) === 'evening'; // the morning is over
  if (!passed && session === 'evening') {
    // Late in the day with no afternoon trip driven: treat it as over.
    const evening = route.eveningStartTime ? toMinutes(route.eveningStartTime) : 15 * 60;
    passed = minutes >= evening + 4 * 60;
  }
  return passed ? nextSchoolDay(today) : today;
}

/**
 * Cancels `choice` ('morning' | 'evening' | 'both') for these students.
 * Runs inside the school's tenant context. Returns what was cancelled:
 * [{ student, name, session, date, already }].
 */
export async function cancelRides({ studentIds, choice, source = 'office', guardian = null, admin = null, now = new Date() }) {
  const sessions = CHOICES[choice];
  if (!sessions) throw new Error('Choose the morning pick-up, the afternoon drop-off or both');
  const students = await Student.find({ _id: { $in: studentIds }, status: 'Active' })
    .select('firstName lastName route rideSession')
    .populate('route', 'morningStartTime eveningStartTime')
    .lean();

  const done = [];
  for (const s of students) {
    for (const session of sessions) {
      if (!s.route || !ridesIn(s.rideSession, session)) continue; // doesn't ride that run
      // eslint-disable-next-line no-await-in-loop
      const date = await dayForCancellation(s.route, session, now);
      // eslint-disable-next-line no-await-in-loop
      const res = await RideCancellation.updateOne(
        { student: s._id, date, session },
        { $setOnInsert: { student: s._id, date, session, source, guardian, createdBy: admin } },
        { upsert: true }
      );
      done.push({ student: s._id, name: `${s.firstName} ${s.lastName}`, session, date, already: !res.upsertedCount });
    }
  }
  return done;
}

/** Student ids cancelled for this school day and run (for building the trip roster). */
export async function cancelledStudentIds(key, session) {
  const rows = await RideCancellation.find({ date: key, session }).select('student').lean();
  return new Set(rows.map((r) => String(r.student)));
}

/** Upcoming cancellations for one student (today onwards), soonest first. */
export async function upcomingForStudent(studentId, now = new Date()) {
  return RideCancellation.find({ student: studentId, date: { $gte: dateKey(now) } })
    .sort({ date: 1, session: -1 })
    .lean();
}

/** Undo a cancellation, unless that run has already started. */
export async function undoCancellation(id) {
  const row = await RideCancellation.findById(id).lean();
  if (!row) return { error: 'This cancellation was not found', status: 404 };
  const student = await Student.findById(row.student).select('route').lean();
  if (student?.route && row.date === dateKey(new Date()) && (await runUnderway(student.route, row.session, row.date))) {
    return { error: 'That run has already started, so the cancellation can no longer be undone', status: 400 };
  }
  await RideCancellation.deleteOne({ _id: id });
  return { ok: true };
}

/**
 * What to do when a parent presses a key on the AwaBus phone line.
 * Returns one of:
 *   { hangup: true }                                  unknown number
 *   { cancelled: [...], choice }                      keys 1-3
 *   { connectTo: ['+233...'], drivers: [...] }        key 4 (bridge the call)
 *   { invalid: true }                                 any other key
 * Each school the caller is a parent at is handled in that school's context.
 */
export async function handleParentKey({ callerPhone, key, now = new Date() }) {
  const guardians = await tenantContext.runAsSystem(() =>
    Guardian.find({ phone: { $in: ghanaPhoneVariants(callerPhone) } }).select('_id school').lean()
  );
  if (!guardians.length) return { hangup: true };

  const digit = String(key).trim();
  const choice = KEY_CHOICES[digit];
  if (!choice && digit !== '4') return { invalid: true };

  const cancelled = [];
  const connectTo = [];
  const drivers = [];
  for (const g of guardians) {
    // eslint-disable-next-line no-await-in-loop
    await tenantContext.run(String(g.school), async () => {
      const children = await Student.find({ primaryGuardian: g._id, status: 'Active' }).select('_id route').lean();
      if (choice) {
        cancelled.push(...(await cancelRides({ studentIds: children.map((c) => c._id), choice, source: 'phone', guardian: g._id, now })));
        return;
      }
      const routes = [...new Set(children.map((c) => String(c.route)).filter((r) => r && r !== 'null'))];
      const found = await Driver.find({ assignedRoute: { $in: routes }, status: { $ne: 'Inactive' } })
        .select('firstName lastName phone')
        .lean();
      found.forEach((d) => {
        if (d.phone && !connectTo.includes(d.phone)) {
          connectTo.push(d.phone);
          drivers.push({ name: `${d.firstName} ${d.lastName}`, phone: d.phone });
        }
      });
    });
  }
  return choice ? { cancelled, choice } : { connectTo, drivers };
}
