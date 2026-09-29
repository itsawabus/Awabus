import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

import School from '../models/School.js';
import Admin from '../models/Admin.js';
import Driver from '../models/Driver.js';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import Student from '../models/Student.js';
import Guardian from '../models/Guardian.js';
import Trip from '../models/Trip.js';
import OtpToken from '../models/OtpToken.js';
import Counter from '../models/Counter.js';

import { tenantContext } from '../utils/tenantContext.js';
import { SCHOOL, ADMIN, PLACES, DRIVERS, BUSES, ROUTES, buildStudents, TRIP_STATUSES } from './data.js';

const pad = (n, size = 3) => String(n).padStart(size, '0');

// Wiping the DB touches every tenant, so this runs outside any single
// school's context — it's the one place in this script that legitimately
// needs to bypass tenant scoping.
const destroy = async () => {
  await tenantContext.runAsSystem(async () => {
    await Promise.all([
      School.deleteMany(),
      Admin.deleteMany(),
      Driver.deleteMany(),
      Bus.deleteMany(),
      Route.deleteMany(),
      Student.deleteMany(),
      Guardian.deleteMany(),
      Trip.deleteMany(),
      OtpToken.deleteMany(),
      Counter.deleteMany(),
    ]);
  });
  console.log('[seed] All collections cleared');
};

// Everything below is the *same* seeding logic as before — it doesn't need
// to know about `school` at all. Because it all runs inside
// tenantContext.run(school._id, ...), the tenantScope mongoose plugin stamps
// `school` onto every create/insertMany/findByIdAndUpdate automatically.
const seedSchoolData = async (school) => {
  // 1. Admin
  await Admin.create(ADMIN);
  console.log(`[seed] Admin created: ${ADMIN.phone} / ${ADMIN.password}`);

  // 2. Buses
  const buses = await Bus.insertMany(BUSES);
  console.log(`[seed] ${buses.length} buses created`);

  // 3. Drivers
  // Created one at a time (not insertMany) so the pre('save') hook actually
  // hashes each driver's seeded `password` — insertMany skips document
  // middleware, which would otherwise leave passwords stored in plaintext.
  const drivers = [];
  for (const d of DRIVERS) {
    // eslint-disable-next-line no-await-in-loop
    const driver = await Driver.create({
      ...d,
      licenseValidation: { status: 'verified', message: 'License details saved', checkedAt: new Date() },
    });
    drivers.push(driver);
  }
  console.log(`[seed] ${drivers.length} drivers created`);

  // 4. Routes (paired 1:1 by index with drivers/buses)
  const routes = [];
  for (let i = 0; i < ROUTES.length; i += 1) {
    const cfg = ROUTES[i];
    const from = PLACES[cfg.from];
    const to = PLACES[cfg.to];
    const bus = buses[i % buses.length];
    const driver = drivers[i % drivers.length];

    // eslint-disable-next-line no-await-in-loop
    const route = await Route.create({
      routeId: `RT-${pad(i + 1)}`,
      name: cfg.name,
      assignedBus: bus._id,
      assignedDriver: driver._id,
      status: cfg.status,
      morningStartTime: '06:00',
      eveningStartTime: '15:00',
      stops: [
        { name: cfg.from.replace(/([A-Z])/g, ' $1').trim(), order: 1, lat: from.lat, lng: from.lng },
        {
          name: cfg.to.replace(/([A-Z])/g, ' $1').trim(),
          order: 2,
          lat: to.lat + (Math.random() - 0.5) * 0.01,
          lng: to.lng + (Math.random() - 0.5) * 0.01,
        },
      ],
    });
    routes.push(route);

    // eslint-disable-next-line no-await-in-loop
    await Bus.findByIdAndUpdate(bus._id, { assignedRoute: route._id, assignedDriver: driver._id });
    // eslint-disable-next-line no-await-in-loop
    await Driver.findByIdAndUpdate(driver._id, {
      assignedRoute: route._id,
      assignedBus: bus._id,
      assignmentHistory: [{ bus: bus._id, route: route._id, from: new Date('2024-01-01'), status: 'Active' }],
    });
  }
  console.log(`[seed] ${routes.length} routes created`);

  // 5. Guardians + Students (attached to a route + that route's bus)
  const studentSeeds = buildStudents(36);
  const students = [];
  for (let i = 0; i < studentSeeds.length; i += 1) {
    const s = studentSeeds[i];
    const route = routes[s.routeIndex];

    // eslint-disable-next-line no-await-in-loop
    const guardian = await Guardian.create({
      firstName: s.guardianFirst,
      lastName: s.guardianLast,
      relation: i % 3 === 0 ? 'Mother' : 'Father',
      phone: `+23324${String(1000000 + i).slice(-7)}`,
      email: `${s.guardianFirst}.${s.guardianLast}@gmail.com`.toLowerCase(),
    });

    const stop = route.stops[0];
    // eslint-disable-next-line no-await-in-loop
    const student = await Student.create({
      studentCode: `ST-2026-${pad(i + 1)}`,
      firstName: s.firstName,
      lastName: s.lastName,
      dob: s.dob,
      gender: s.gender,
      classGrade: s.classGrade,
      primaryGuardian: guardian._id,
      route: route._id,
      bus: route.assignedBus,
      pickupPoint: `${stop.name} Station`,
      dropoffPoint: `${stop.name} Station`,
      pickupTime: s.pickupTime,
      dropoffTime: s.dropoffTime,
      homeAddress: `House No ${i + 1}, ${stop.name}, Accra`,
      geofenceRadius: 200,
      lat: stop.lat + (Math.random() - 0.5) * 0.01,
      lng: stop.lng + (Math.random() - 0.5) * 0.01,
      status: 'Active',
      todayAttendance: i % 6 === 0 ? 'Absent' : 'Present',
      communications: [
        {
          title: 'Geofence Entry Alert Sent',
          description: `SMS alert sent to ${s.guardianFirst} ${s.guardianLast}: '${s.firstName} entered geofence'`,
          occurredAt: new Date(),
        },
      ],
    });
    students.push(student);

    // eslint-disable-next-line no-await-in-loop
    await Route.findByIdAndUpdate(route._id, { $addToSet: { students: student._id } });
  }
  console.log(`[seed] ${students.length} students + guardians created`);

  // 6. Historical trips (last ~10 days, 2 trips/route/day for the first 5 routes)
  let tripCounter = 100;
  const trips = [];
  for (let dayOffset = 10; dayOffset >= 1; dayOffset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    for (let r = 0; r < 5; r += 1) {
      const route = routes[r];
      const status = TRIP_STATUSES[(dayOffset + r) % TRIP_STATUSES.length];
      tripCounter += 1;
      // eslint-disable-next-line no-await-in-loop
      trips.push(
        // eslint-disable-next-line no-await-in-loop
        await Trip.create({
          tripCode: `TRP-${tripCounter}`,
          route: route._id,
          bus: route.assignedBus,
          driver: route.assignedDriver,
          date,
          departureTime: '06:30 AM',
          arrivalTime: status === 'Cancelled' ? '' : status === 'In Progress' ? '' : '07:45 AM',
          durationMinutes: status === 'Completed' ? 75 : status === 'Delayed' ? 95 : 0,
          status,
          gpsSignal: 'ok',
        })
      );
    }
  }
  console.log(`[seed] ${trips.length} historical trips created`);

  // 7. Two "in progress" demo trips (for the Live Tracking + dashboard screens)
  const liveRoutes = [routes[0], routes[1]];
  for (const route of liveRoutes) {
    const routeStudents = students.filter((s) => String(s.route) === String(route._id)).slice(0, 6);
    const start = route.stops[0];
    // eslint-disable-next-line no-await-in-loop
    await Trip.create({
      tripCode: `TRP-0${(tripCounter += 1)}`,
      route: route._id,
      bus: route.assignedBus,
      driver: route.assignedDriver,
      date: new Date(),
      departureTime: '06:43 AM',
      status: 'In Progress',
      gpsSignal: 'ok',
      etaMinutes: 17,
      distanceCoveredKm: 8.2,
      liveLocation: { lat: start.lat, lng: start.lng, heading: 45, updatedAt: new Date() },
      stops: route.stops,
      timeline: [
        { time: '06:43', title: 'Trip started', description: 'Departure from main bus lot, vehicle check passed.' },
        { time: '06:45', title: 'GPS streaming began', description: 'Active connection established with AwaBus servers.' },
        { time: '06:52', title: `Proximity alert — ${routeStudents[0]?.firstName || 'Student'}`, description: 'Bus entered the student\'s notification zone.' },
      ],
      studentProgress: routeStudents.map((s, idx) => ({
        student: s._id,
        attendance: idx === routeStudents.length - 1 ? 'Absent' : 'Present',
        alertStatus: idx < 2 ? 'Not sent (alerts are off)' : 'Not yet alerted',
        alertTime: idx < 2 ? '06:5' + idx : '',
        dropoffStatus: idx < 2 ? 'Dropped off' : idx < 4 ? 'On board' : 'Pending',
      })),
    });
    // eslint-disable-next-line no-await-in-loop
    await Bus.findByIdAndUpdate(route.assignedBus, {
      status: 'Active',
      gpsSignal: 'ok',
      lastKnownLocation: { lat: start.lat, lng: start.lng, heading: 45, updatedAt: new Date() },
    });
  }
  console.log('[seed] 2 live in-progress trips created');

  return { drivers };
};

// The seed deletes every school's data, not just the demo school. Refuse when
// that would destroy real data, unless explicitly told to.
const FORCE_FLAG = '--wipe-everything';
const assertSafeToWipe = async () => {
  if (process.argv.includes(FORCE_FLAG)) return;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`NODE_ENV is "production". The seed deletes ALL data. Run it against a test database, or add ${FORCE_FLAG} if you are sure.`);
  }
  const others = await tenantContext.runAsSystem(() => School.find({ code: { $ne: SCHOOL.code } }).select('name').lean());
  if (others.length) {
    const names = others.slice(0, 5).map((o) => o.name).join(', ');
    throw new Error(
      `This database has other schools (${names}${others.length > 5 ? ', ...' : ''}). The seed would delete them. Use a separate test database, or add ${FORCE_FLAG} if you are sure.`
    );
  }
};

const run = async () => {
  await connectDB();
  await assertSafeToWipe();

  if (process.argv.includes('--destroy')) {
    await destroy();
    return mongoose.disconnect();
  }

  await destroy();

  // The School itself is created outside any tenant context (nothing to scope it to yet).
  const school = await tenantContext.runAsSystem(() => School.create(SCHOOL));
  console.log(`[seed] School created: ${school.name} (${school.code})`);

  // Everything else runs inside this school's tenant context, so every
  // create/insertMany/findByIdAndUpdate above gets `school` stamped on
  // automatically by the tenantScope plugin.
  const { drivers } = await tenantContext.run(school._id, () => seedSchoolData(school));
  const demoDriver = drivers[0];

  console.log('\n[seed] Done!\n');
  console.log('  Admin Portal:');
  console.log(`    school:   ${school.name} (${school.code})`);
  console.log(`    email:    ${ADMIN.email}`);
  console.log(`    password: ${ADMIN.password}\n`);
  console.log('  Driver App:');
  console.log(`    phone:    ${demoDriver.phone}`);
  console.log(`    password: Driver@123\n`);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[seed] Stopped:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});