// Numbers for the superadmin Platform page: per-school figures, platform
// totals, trends and a "needs attention" list. Everything is worked out here
// from a few lean, field-limited reads so the page makes one request.
import School from '../models/School.js';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import Bus from '../models/Bus.js';
import Driver from '../models/Driver.js';
import RouteModel from '../models/Route.js';
import Trip from '../models/Trip.js';

const DAY = 24 * 60 * 60 * 1000;
export const INSIGHT_RANGES = [7, 30, 90];
const GROWTH_WEEKS = 12;
const LICENSE_SOON_DAYS = 30;

const dayKey = (d) => new Date(d).toISOString().slice(0, 10); // schools run on Africa/Accra = UTC
const startOfUtcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const validDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

// What happened on a trip, for the charts.
export function tripOutcome(t) {
  if (t.status === 'Cancelled') return 'cancelled';
  if (t.autoEnded) return 'autoEnded';
  const finished = Boolean(t.endedAt || t.arrivalTime);
  if ((t.status === 'In Progress' || t.status === 'Delayed') && !finished) return 'live';
  if (t.status === 'Delayed' || (t.delayBroadcasts || []).length) return 'delayed';
  if (t.status === 'Completed') return 'onTime';
  return null; // Scheduled: not run yet
}

const emptyOutcomes = () => ({ onTime: 0, delayed: 0, autoEnded: 0, cancelled: 0, live: 0 });
const emptyStudents = () => ({ carried: 0, absent: 0, notOnBoard: 0, notRecorded: 0 });

function studentOutcome(p) {
  if (p.attendance === 'Absent') return 'absent';
  if (p.attendance === 'Cancelled') return null;
  if (p.dropoffStatus === 'On board' || p.dropoffStatus === 'Dropped off') return 'carried';
  if (p.dropoffStatus === 'Not on board') return 'notOnBoard';
  return 'notRecorded';
}

export async function buildInsights({ days = 30, schoolId = null, now = new Date() } = {}) {
  const today = startOfUtcDay(now);
  const start = new Date(today.getTime() - (days - 1) * DAY);
  const prevStart = new Date(start.getTime() - days * DAY);
  const growthStart = new Date(today.getTime() - (GROWTH_WEEKS * 7 - 1) * DAY);
  const soon = new Date(now.getTime() + LICENSE_SOON_DAYS * DAY);

  const [schools, admins, students, buses, drivers, routes, trips] = await Promise.all([
    School.find({}).select('name code status createdAt').sort({ createdAt: 1 }).lean(),
    Admin.find({ role: 'admin' }).select('school password').lean(),
    Student.find({}).select('school route bus createdAt').lean(),
    Bus.find({}).select('school capacity status assignedDriver plateNumber').lean(),
    Driver.find({}).select('school assignedBus licenseExpiry').lean(),
    RouteModel.find({}).select('school assignedBus').lean(),
    Trip.find({ date: { $gte: prevStart } })
      .select('school date status autoEnded endedAt arrivalTime delayBroadcasts studentProgress.attendance studentProgress.dropoffStatus')
      .lean(),
  ]);

  const dayKeys = Array.from({ length: days }, (_, i) => dayKey(new Date(start.getTime() + i * DAY)));
  const weekStarts = Array.from({ length: GROWTH_WEEKS }, (_, i) => new Date(growthStart.getTime() + i * 7 * DAY));

  const bySchool = new Map(
    schools.map((s) => [
      String(s._id),
      {
        id: String(s._id),
        // older records may be missing fields; never let one bad record break the page
        name: s.name || 'Unnamed school',
        code: s.code || '',
        status: s.status || 'Active',
        createdAt: s.createdAt,
        admins: 0,
        adminsPending: 0,
        students: 0,
        studentsNew: 0,
        studentsNoRoute: 0,
        studentsWithBus: 0,
        buses: 0,
        capacity: 0,
        seatedOnSized: 0, // students on buses whose seats are known (capacity is optional)
        busStatus: { Active: 0, Idle: 0, Maintenance: 0 },
        busesNoDriver: 0,
        overCapacityBuses: [],
        drivers: 0,
        licenseExpired: 0,
        licenseSoon: 0,
        routes: 0,
        routesNoBus: 0,
        trips: emptyOutcomes(),
        prevTrips: emptyOutcomes(),
        studentOutcomes: emptyStudents(),
        lastTripAt: null,
        daily: Object.fromEntries(dayKeys.map((k) => [k, 0])),
      },
    ])
  );
  const S = (id) => bySchool.get(String(id));

  admins.forEach((a) => {
    const s = S(a.school);
    if (!s) return;
    s.admins += 1;
    if (!a.password) s.adminsPending += 1;
  });

  const perBus = new Map();
  students.forEach((st) => {
    const s = S(st.school);
    if (!s) return;
    st.createdAt = validDate(st.createdAt) || new Date(0); // no date = count as an existing student
    s.students += 1;
    if (st.createdAt >= start) s.studentsNew += 1;
    if (!st.route) s.studentsNoRoute += 1;
    if (st.bus) {
      s.studentsWithBus += 1;
      perBus.set(String(st.bus), (perBus.get(String(st.bus)) || 0) + 1);
    }
  });

  buses.forEach((b) => {
    const s = S(b.school);
    if (!s) return;
    s.buses += 1;
    s.capacity += b.capacity || 0;
    if (b.capacity) s.seatedOnSized += perBus.get(String(b._id)) || 0;
    if (s.busStatus[b.status] !== undefined) s.busStatus[b.status] += 1;
    if (!b.assignedDriver) s.busesNoDriver += 1;
    const riders = perBus.get(String(b._id)) || 0;
    if (b.capacity && riders > b.capacity) s.overCapacityBuses.push({ plate: b.plateNumber, riders, capacity: b.capacity });
  });

  drivers.forEach((d) => {
    const s = S(d.school);
    if (!s) return;
    s.drivers += 1;
    const expiry = validDate(d.licenseExpiry);
    if (expiry && expiry < now) s.licenseExpired += 1;
    else if (expiry && expiry <= soon) s.licenseSoon += 1;
  });

  routes.forEach((r) => {
    const s = S(r.school);
    if (!s) return;
    s.routes += 1;
    if (!r.assignedBus) s.routesNoBus += 1;
  });

  // Platform-wide (or single-school) daily series, split by outcome.
  const inScope = (id) => !schoolId || String(id) === String(schoolId);
  const daily = Object.fromEntries(dayKeys.map((k) => [k, emptyOutcomes()]));

  trips.forEach((t) => {
    const s = S(t.school);
    t.date = validDate(t.date);
    if (!s || !t.date) return; // skip trips without a usable date
    const outcome = tripOutcome(t);
    if (!outcome) return;
    if (!s.lastTripAt || t.date > s.lastTripAt) s.lastTripAt = t.date;
    if (t.date < start) {
      s.prevTrips[outcome] += 1;
      return;
    }
    s.trips[outcome] += 1;
    const k = dayKey(t.date);
    if (s.daily[k] !== undefined) s.daily[k] += 1;
    if (inScope(t.school) && daily[k]) daily[k][outcome] += 1;
    if (outcome !== 'cancelled') {
      (t.studentProgress || []).forEach((p) => {
        const o = studentOutcome(p);
        if (o) s.studentOutcomes[o] += 1;
      });
    }
  });

  // Derived rates for each school.
  const list = [...bySchool.values()].map((s) => {
    const ran = (o) => o.onTime + o.delayed + o.autoEnded;
    const so = s.studentOutcomes;
    const rostered = so.carried + so.absent + so.notOnBoard + so.notRecorded;
    return {
      ...s,
      daily: dayKeys.map((k) => s.daily[k]),
      tripsTotal: ran(s.trips) + s.trips.cancelled,
      prevTripsTotal: ran(s.prevTrips) + s.prevTrips.cancelled,
      onTimeRate: pct(s.trips.onTime, s.trips.onTime + s.trips.delayed),
      prevOnTimeRate: pct(s.prevTrips.onTime, s.prevTrips.onTime + s.prevTrips.delayed),
      seatUse: pct(s.seatedOnSized, s.capacity),
      absenceRate: pct(so.absent, rostered),
      rostered,
    };
  });

  const scope = schoolId ? list.filter((s) => s.id === String(schoolId)) : list;
  const sum = (key) => scope.reduce((n, s) => n + (typeof key === 'function' ? key(s) : s[key]), 0);
  const sumObj = (key, keys) => Object.fromEntries(keys.map((k) => [k, sum((s) => s[key][k])]));
  const outcomes = sumObj('trips', Object.keys(emptyOutcomes()));
  const prevOutcomes = sumObj('prevTrips', Object.keys(emptyOutcomes()));
  const studentOutcomes = sumObj('studentOutcomes', Object.keys(emptyStudents()));
  const rostered = Object.values(studentOutcomes).reduce((a, b) => a + b, 0);
  const capacity = sum('capacity');

  // Students on the platform at the end of each of the last 12 weeks.
  const scopedStudents = students.filter((st) => bySchool.has(String(st.school)) && inScope(st.school));
  const growth = weekStarts.map((ws) => {
    const end = new Date(ws.getTime() + 7 * DAY);
    return {
      week: dayKey(ws),
      total: scopedStudents.filter((st) => st.createdAt < end).length,
      added: scopedStudents.filter((st) => st.createdAt >= ws && st.createdAt < end).length,
    };
  });

  const totals = {
    schools: scope.length,
    activeSchools: scope.filter((s) => s.status === 'Active').length,
    suspendedSchools: scope.filter((s) => s.status !== 'Active').length,
    admins: sum('admins'),
    adminsPending: sum('adminsPending'),
    students: sum('students'),
    studentsNew: sum('studentsNew'),
    studentsNoRoute: sum('studentsNoRoute'),
    buses: sum('buses'),
    capacity,
    seatsUsed: sum('seatedOnSized'),
    seatUse: pct(sum('seatedOnSized'), capacity),
    busStatus: sumObj('busStatus', ['Active', 'Idle', 'Maintenance']),
    drivers: sum('drivers'),
    licenseExpired: sum('licenseExpired'),
    licenseSoon: sum('licenseSoon'),
    routes: sum('routes'),
    routesNoBus: sum('routesNoBus'),
    trips: outcomes,
    tripsTotal: outcomes.onTime + outcomes.delayed + outcomes.autoEnded + outcomes.cancelled,
    prevTripsTotal: prevOutcomes.onTime + prevOutcomes.delayed + prevOutcomes.autoEnded + prevOutcomes.cancelled,
    onTimeRate: pct(outcomes.onTime, outcomes.onTime + outcomes.delayed),
    prevOnTimeRate: pct(prevOutcomes.onTime, prevOutcomes.onTime + prevOutcomes.delayed),
    liveNow: outcomes.live,
    studentOutcomes,
    absenceRate: pct(studentOutcomes.absent, rostered),
  };

  return {
    range: { days, start: dayKey(start), end: dayKey(today) },
    school: schoolId ? String(schoolId) : null,
    totals,
    daily: dayKeys.map((k) => ({ day: k, ...daily[k] })),
    growth,
    schools: list.map(({ overCapacityBuses, ...s }) => ({ ...s, overCapacity: overCapacityBuses.length })),
    attention: attentionItems(list.filter((s) => inScope(s.id)), { days, overCapacity: new Map(list.map((s) => [s.id, s.overCapacityBuses])) }),
  };
}

const SEVERITY_ORDER = { critical: 0, serious: 1, warning: 2, info: 3 };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Things a platform admin should look at, most serious first.
function attentionItems(list, { days, overCapacity }) {
  const items = [];
  const add = (s, severity, text) => items.push({ schoolId: s.id, school: s.name, severity, text });
  list.forEach((s) => {
    if (s.status !== 'Active') {
      add(s, 'info', `School is ${s.status.toLowerCase()}`);
      return;
    }
    if (s.studentOutcomes.notOnBoard) add(s, 'critical', `${plural(s.studentOutcomes.notOnBoard, 'student')} marked not on board in the last ${days} days`);
    if (s.licenseExpired) add(s, 'critical', `${plural(s.licenseExpired, 'driver')} with an expired license`);
    const over = (overCapacity.get(s.id) || []).sort((a, b) => b.riders / b.capacity - a.riders / a.capacity);
    if (over.length === 1) add(s, 'critical', `Bus ${over[0].plate} has ${over[0].riders} students for ${over[0].capacity} seats`);
    else if (over.length) add(s, 'critical', `${over.length} buses have more students than seats (worst: ${over[0].plate}, ${over[0].riders} for ${over[0].capacity})`);
    if (s.admins && s.adminsPending === s.admins) add(s, 'serious', 'School admin has never signed in');
    if (s.routesNoBus) add(s, 'serious', `${plural(s.routesNoBus, 'route')} without a bus`);
    if (s.busesNoDriver) add(s, 'serious', `${plural(s.busesNoDriver, 'bus', 'buses')} without a driver`);
    if (s.trips.autoEnded) add(s, 'warning', `${plural(s.trips.autoEnded, 'trip')} not ended by the driver`);
    if (s.licenseSoon) add(s, 'warning', `${plural(s.licenseSoon, 'driver license')} expiring within ${LICENSE_SOON_DAYS} days`);
    if (s.studentsNoRoute) add(s, 'warning', `${plural(s.studentsNoRoute, 'student')} not on any route`);
    if (s.routes && !s.tripsTotal) add(s, 'warning', `No trips in the last ${days} days`);
  });
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.school.localeCompare(b.school));
}
