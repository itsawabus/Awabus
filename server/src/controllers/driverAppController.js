// Driver App API (mobile) — backend surface for the AwaBus Driver App in /driver.

import asyncHandler from 'express-async-handler';
import { ghanaPhoneVariants, normalizeGhanaPhone } from '../utils/phone.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Driver from '../models/Driver.js';
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import RouteModel from '../models/Route.js';
import Student from '../models/Student.js';
import OtpToken from '../models/OtpToken.js';
import AppCrash from '../models/AppCrash.js';
import generateToken from '../utils/generateToken.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { nextSequentialCode } from '../utils/idGenerator.js';
import { generateOtpCode, sendOtpSms, getOtpExpiry } from '../utils/otp.js';
// Parent SMS (delay notices, messages from the bus): named arguments, returns { status }.
import { sendSms as sendMessage } from '../services/messaging/index.js';
import { tenantContext } from '../utils/tenantContext.js';
import { MAX_OTP_ATTEMPTS } from './authController.js';
import { signResetToken, readResetToken } from '../utils/resetToken.js';
import { schoolStatus, accessError, SCHOOL_SUSPENDED_MESSAGE, DRIVER_INACTIVE_MESSAGE } from '../utils/access.js';
import { forgetBusLocation } from '../middleware/auth.js';
import { notify, describeTrip } from '../services/notify.js';
import { emitToSchool } from '../sockets/rooms.js';
import { checkSetupCode, clearSetupCode, SETUP_CODE_MESSAGES } from '../utils/setupCode.js';
import { inGhana } from '../utils/geo.js';
import { sessionFor, ridesIn, runWords, delayAffects } from '../utils/sessions.js';
import { alertForScan } from '../services/parentAlerts.js';
import { driverReading } from '../services/busPosition.js';
import { cancelledStudentIds, dateKey } from '../services/rideCancellations.js';
import { createPass, revokePass, assistantsWithStatus } from '../services/assistPass.js';

// What the driver sees about each student: name, class and the parent to call.
export const STUDENT_FOR_DRIVER = {
  path: 'studentProgress.student',
  // lat / lng: the home, so the list can put the next child to pick up or drop first.
  select: 'firstName lastName studentCode classGrade primaryGuardian lat lng',
  populate: { path: 'primaryGuardian', select: 'firstName lastName relation phone' },
};

// Trip rules shared by the driver actions below.
const LIVE = ['In Progress', 'Delayed'];
const isLive = (trip) => LIVE.includes(trip.status);
// Scans that were queued offline can still arrive a while after the trip ended.
const LATE_SCAN_GRACE_MS = 2 * 60 * 60 * 1000;
// Delay SMS: parents should not be flooded, and one SMS is 160 characters.
export const DELAY_LIMITS = { perTrip: 3, minMinutesApart: 10, maxMessage: 100 };
const refuseTrip = (res, status, code, message) => {
  res.status(status);
  const err = new Error(message);
  err.errorCode = code;
  return err;
};

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const driverProfile = (driver) => ({
  id: driver._id,
  name: `${driver.firstName} ${driver.lastName}`,
  phone: driver.phone,
  status: driver.status,
  profilePhotoUrl: driver.profilePhotoUrl,
});

// These routes all run before anyone is authenticated, so there's no
// req.school / tenant context yet — finding out *which* school a driver
// belongs to is the whole point of the lookup. tenantContext.runAsSystem()
// is the deliberate, explicit escape hatch for that (mirrors
// authController.js's findAdminByEmail). Once a driver is found,
// `driver.school` goes into the JWT and every subsequent request is scoped
// normally.
const findDriverByPhone = (phone, withPassword = false) =>
  tenantContext.runAsSystem(() => {
    // Also match numbers saved before phones were normalized (e.g. "0248250754").
    const query = Driver.findOne({ phone: { $in: ghanaPhoneVariants(phone) } });
    return withPassword ? query.select('+password') : query;
  });

const saveDriverAsSystem = (driver) => tenantContext.runAsSystem(() => driver.save());

// @desc    Check if a phone number exists and whether the driver has a password set
// @route   POST /api/driver-app/auth/check-phone
export const checkDriverPhone = asyncHandler(async (req, res) => {
  const phone = normalizeGhanaPhone(req.body.phone);
  if (!phone) {
    res.status(400);
    throw new Error('Phone number is required');
  }

  const driver = await findDriverByPhone(phone, true);

  if (!driver) {
    res.status(404);
    throw new Error('No driver account found with this phone number');
  }

  res.json({
    success: true,
    exists: true,
    hasPassword: Boolean(driver.password),
  });
});

// @desc    Set a password for a first-time driver account and sign in
// @route   POST /api/driver-app/auth/set-password
export const setDriverPassword = asyncHandler(async (req, res) => {
  const phone = normalizeGhanaPhone(req.body.phone);
  const { password, setupCode } = req.body;
  if (!phone || !password) {
    res.status(400);
    throw new Error('Phone number and password are required');
  }

  const driver = await tenantContext.runAsSystem(() =>
    Driver.findOne({ phone: { $in: ghanaPhoneVariants(phone) } }).select('+password +setupCodeHash +setupCodeAttempts')
  );

  if (!driver) {
    res.status(404);
    throw new Error('No driver account found with this phone number');
  }

  if (driver.password) {
    res.status(400);
    throw new Error('This account already has a password set');
  }

  // Only the driver the school handed the setup code to can set the password.
  const codeCheck = checkSetupCode(driver, setupCode);
  if (codeCheck !== 'ok') {
    if (codeCheck === 'wrong' || codeCheck === 'locked') await saveDriverAsSystem(driver);
    res.status(400);
    throw new Error(SETUP_CODE_MESSAGES[codeCheck]);
  }

  driver.password = password;
  clearSetupCode(driver);
  await saveDriverAsSystem(driver);

  res.json({
    success: true,
    token: generateToken(driver._id, 'driver', { school: driver.school }),
    driver: driverProfile(driver),
  });
});

// @desc    Driver app sign in
// @route   POST /api/driver-app/auth/login
export const driverLogin = asyncHandler(async (req, res) => {
  const phone = normalizeGhanaPhone(req.body.phone);
  const { password } = req.body;
  if (!phone || !password) {
    res.status(400);
    throw new Error('Phone number and password are required');
  }

  const driver = await findDriverByPhone(phone, true);
  if (!driver || !driver.password) {
    res.status(401);
    throw new Error('Invalid phone number or password');
  }
  const match = await bcrypt.compare(password, driver.password);
  if (!match) {
    res.status(401);
    throw new Error('Invalid phone number or password');
  }
  if (driver.status === 'Inactive') throw accessError(res, 'DRIVER_INACTIVE', DRIVER_INACTIVE_MESSAGE);
  if ((await schoolStatus(driver.school)) !== 'Active') throw accessError(res, 'SCHOOL_SUSPENDED', SCHOOL_SUSPENDED_MESSAGE);

  res.json({
    success: true,
    token: generateToken(driver._id, 'driver', { school: driver.school }),
    driver: driverProfile(driver),
  });
});

// @desc    Get logged-in driver profile + assignment
// @route   GET /api/driver-app/me
export const getDriverMe = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.driver._id)
    .populate('assignedBus', 'plateNumber name capacity')
    .populate('assignedRoute', 'routeId name stops students');
  res.json({ success: true, data: driver });
});

// @desc    Bus assistant pass for a trip: is one active, and who used it
// @route   GET /api/driver-app/trips/:id/assist-pass
export const getAssistPass = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).select('status assistPass assistants').lean();
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  const p = trip.assistPass || {};
  const active = Boolean(p.hash) && ASSIST_OPEN.includes(trip.status) && (!p.expiresAt || new Date(p.expiresAt) > new Date());
  const assistants = assistantsWithStatus(trip);
  res.json({ success: true, data: { active, createdAt: p.createdAt, expiresAt: p.expiresAt, assistants, connected: assistants.some((a) => a.connected) } });
});

// @desc    New bus assistant QR code for a trip (any earlier one stops working)
// @route   POST /api/driver-app/trips/:id/assist-pass
export const createAssistPass = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).select('status');
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  if (!ASSIST_OPEN.includes(trip.status)) throw refuseTrip(res, 409, 'TRIP_OVER', 'This trip has ended. A bus assistant can join your next trip.');
  res.status(201).json({ success: true, data: await createPass(trip) });
});

// @desc    Stop sharing the trip with the bus assistant
// @route   DELETE /api/driver-app/trips/:id/assist-pass
export const deleteAssistPass = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).select('_id');
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  await revokePass(trip._id);
  res.json({ success: true });
});

const ASSIST_OPEN = ['Scheduled', 'In Progress', 'Delayed'];

// Texts from the bus to one parent: short, and not too many.
export const PARENT_MESSAGE_LIMITS = { maxLength: 140, perStudentPerTrip: 3, minSecondsApart: 60 };

// @desc    Text one student's parent from the bus (sent through the AwaBus SMS line)
//          body: { text }
// @route   POST /api/driver-app/trips/:id/students/:studentId/message
export const messageParent = asyncHandler(async (req, res) => {
  const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    res.status(400);
    throw new Error('Type a message first');
  }
  if (text.length > PARENT_MESSAGE_LIMITS.maxLength) {
    res.status(400);
    throw new Error(`Keep the message to ${PARENT_MESSAGE_LIMITS.maxLength} characters so it fits in one SMS.`);
  }
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).populate('bus', 'plateNumber');
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  if (!['Scheduled', 'In Progress', 'Delayed'].includes(trip.status)) {
    throw refuseTrip(res, 409, 'TRIP_OVER', 'This trip has ended. Call the parent or the school office instead.');
  }
  const onTrip = trip.studentProgress.some((p) => String(p.student) === String(req.params.studentId));
  if (!onTrip) {
    res.status(404);
    throw new Error('This student is not on this trip');
  }
  const earlier = (trip.parentMessages || []).filter((m) => String(m.student) === String(req.params.studentId));
  if (earlier.length >= PARENT_MESSAGE_LIMITS.perStudentPerTrip) {
    throw refuseTrip(res, 429, 'MESSAGE_LIMIT', `This parent has already had ${PARENT_MESSAGE_LIMITS.perStudentPerTrip} messages on this trip. Call them instead.`);
  }
  const last = earlier.length ? new Date(earlier[earlier.length - 1].sentAt).getTime() : 0;
  const waitSec = Math.ceil((last + PARENT_MESSAGE_LIMITS.minSecondsApart * 1000 - Date.now()) / 1000);
  if (waitSec > 0) throw refuseTrip(res, 429, 'MESSAGE_TOO_SOON', `You just messaged this parent. Wait ${waitSec} seconds.`);

  const student = await Student.findById(req.params.studentId).select('firstName primaryGuardian').populate('primaryGuardian', 'phone');
  const phone = student?.primaryGuardian?.phone;
  if (!phone) {
    res.status(400);
    throw new Error('There is no phone number for this parent');
  }
  const plate = trip.bus?.plateNumber ? ` ${trip.bus.plateNumber}` : '';
  const smsText = `AwaBus (school bus${plate}): ${text}`;
  const result = await sendMessage({ to: phone, text: smsText, purpose: 'parent_message', school: req.school });
  await Trip.updateOne(
    { _id: trip._id },
    {
      $push: {
        parentMessages: { student: req.params.studentId, text, sentAt: new Date(), status: result?.status || 'failed', by: req.assistant?.label || '' },
      },
    }
  );
  if (result?.status === 'failed') {
    res.status(502);
    throw new Error("The message couldn't be sent. Try again, or call the parent.");
  }
  res.status(201).json({ success: true, status: result.status, preview: smsText });
});

// @desc    Driver signed out of the app: show them offline straight away
// @route   POST /api/driver-app/sign-out
export const driverSignOut = asyncHandler(async (req, res) => {
  const now = new Date();
  await Driver.updateOne({ _id: req.driver._id }, { $set: { signedOutAt: now } });
  // The phone stops reading the bus location, so the bus goes offline too.
  if (req.driver.assignedBus) await Bus.updateOne({ _id: req.driver.assignedBus }, { $set: { locationOffAt: now } });
  forgetBusLocation(req.driver._id);
  res.json({ success: true });
});

// Builds today's trip document for a driver on the fly the first time it's
// requested, from whatever bus/route they're currently assigned. This means
// the driver app works without an admin having to manually schedule a trip
// every day first.
const provisionTodaysTrip = async (driver, dayStart, dayEnd) => {
  if (!driver.assignedBus || !driver.assignedRoute) return null;

  const route = await RouteModel.findById(driver.assignedRoute).populate('students', '_id rideSession');
  if (!route) return null;

  // Morning pick-up before noon, afternoon drop-off from noon; only the students
  // riding that run are on it.
  const session = sessionFor(route);
  const tripCode = await nextSequentialCode(Trip, 'tripCode', 'TRP-', 4);
  // Rides a parent (or the office) cancelled for this run show as "Cancelled".
  const cancelled = await cancelledStudentIds(dateKey(new Date()), session);

  const trip = await Trip.create({
    tripCode,
    route: route._id,
    bus: driver.assignedBus,
    driver: driver._id,
    date: dayStart,
    status: 'Scheduled',
    session,
    stops: route.stops,
    studentProgress: (route.students || []).filter((s) => ridesIn(s.rideSession, session)).map((s) => ({
      student: s._id,
      attendance: cancelled.has(String(s._id)) ? 'Cancelled' : 'Present',
      dropoffStatus: 'Pending',
    })),
  });

  // Two requests arriving together could each create a trip: keep the older one.
  const first = await Trip.findOne({ driver: driver._id, date: { $gte: dayStart, $lte: dayEnd }, status: 'Scheduled' })
    .sort({ createdAt: 1 })
    .select('_id');
  let keep = trip._id;
  if (first && String(first._id) !== String(trip._id)) {
    await Trip.deleteOne({ _id: trip._id });
    keep = first._id;
  }

  return Trip.findById(keep)
    .populate('route', 'routeId name stops morningStartTime eveningStartTime')
    .populate('bus', 'plateNumber name capacity')
    .populate(STUDENT_FOR_DRIVER);
};

// Once a trip exists for today, its studentProgress is a snapshot taken at
// creation time — it's never touched again by getTodaysTrip, so a student
// added to the route (or removed from it) *after* today's trip was already
// provisioned would otherwise never show up for the driver no matter how
// many times they pull-to-refresh. Safe to reconcile only while the trip is
// still 'Scheduled': once it's started, studentProgress carries real
// attendance/dropoff state that must not be clobbered.
const reconcileStudentProgress = async (trip) => {
  if (trip.status !== 'Scheduled') return trip;

  const route = await RouteModel.findById(trip.route._id).populate('students', '_id rideSession');
  if (!route) return trip;

  // Students riding this run only (a change of a student's run shows up too).
  const currentIds = new Set((route.students || []).filter((s) => ridesIn(s.rideSession, trip.session)).map((s) => String(s._id)));
  const existingIds = new Set(trip.studentProgress.map((p) => String(p.student?._id || p.student)));

  const sameMembership =
    currentIds.size === existingIds.size && [...currentIds].every((id) => existingIds.has(id));
  // Cancellations made (or undone) since the trip was prepared.
  const cancelled = await cancelledStudentIds(dateKey(new Date()), trip.session);
  const attendanceFor = (id, current) => {
    if (cancelled.has(id)) return 'Cancelled';
    return current === 'Cancelled' ? 'Present' : current; // cancellation undone
  };
  const sameCancellations = trip.studentProgress.every((p) => {
    const id = String(p.student?._id || p.student);
    return attendanceFor(id, p.attendance) === p.attendance;
  });
  if (sameMembership && sameCancellations) return trip;

  // Rebuild as plain objects (not populated subdocuments) and write via
  // findByIdAndUpdate rather than mutating + saving the populated `trip`
  // document directly — keeps this from depending on how Mongoose casts an
  // already-populated path back down when reassigned.
  const kept = trip.studentProgress
    .filter((p) => currentIds.has(String(p.student?._id || p.student)))
    .map((p) => ({
      student: p.student?._id || p.student,
      attendance: attendanceFor(String(p.student?._id || p.student), p.attendance),
      alertStatus: p.alertStatus,
      alertTime: p.alertTime,
      alertFor: p.alertFor,
      nearHomeAt: p.nearHomeAt,
      nearHomeAlert: p.nearHomeAlert,
      dropoffStatus: p.dropoffStatus,
    }));
  const added = [...currentIds]
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ student: id, attendance: cancelled.has(id) ? 'Cancelled' : 'Present', dropoffStatus: 'Pending' }));

  await Trip.findByIdAndUpdate(trip._id, { studentProgress: [...kept, ...added] });
  return Trip.findById(trip._id)
    .populate('route', 'routeId name stops morningStartTime eveningStartTime')
    .populate('bus', 'plateNumber name capacity')
    .populate(STUDENT_FOR_DRIVER);
};

// @desc    Get today's scheduled/active trip for the logged-in driver
//          (auto-creates one from the driver's current assignment if missing)
// @route   GET /api/driver-app/trips/today
export const getTodaysTrip = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // The trip to show is today's running or not-yet-started one. A driver can
  // do several runs a day (morning, afternoon, a second loop...): once a trip
  // has ended, the next request gets a fresh trip, so every run is tracked
  // live and kept in history on its own.
  let trip = await Trip.findOne({
    driver: req.driver._id,
    date: { $gte: start, $lte: end },
    status: { $in: ['Scheduled', 'In Progress', 'Delayed'] },
  })
    .sort({ createdAt: -1 })
    .populate('route', 'routeId name stops morningStartTime eveningStartTime')
    .populate('bus', 'plateNumber name capacity')
    .populate(STUDENT_FOR_DRIVER);

  // A run that was never started stays behind when its time has passed (the
  // morning trip at evening time): close it and get the current run ready.
  if (trip && trip.status === 'Scheduled' && trip.session && trip.session !== sessionFor(trip.route)) {
    await Trip.updateOne(
      { _id: trip._id, status: 'Scheduled' },
      {
        $set: { status: 'Cancelled' },
        $push: { timeline: { time: timeNow(), title: 'Not driven', description: `The ${runWords(trip.session).name} was never started.` } },
      }
    );
    trip = null;
  }

  if (!trip) {
    trip = await provisionTodaysTrip(req.driver, start, end);
  } else {
    trip = await reconcileStudentProgress(trip);
  }
  const completedToday = await Trip.countDocuments({ driver: req.driver._id, date: { $gte: start, $lte: end }, status: 'Completed' });

  res.json({ success: true, data: trip, completedToday });
});

// @desc    Start a trip
// @route   POST /api/driver-app/trips/:id/start
export const startTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  if (trip.status === 'Completed' || trip.status === 'Cancelled') {
    throw refuseTrip(res, 409, 'TRIP_ENDED', `This trip is already ${trip.status.toLowerCase()} and cannot be started again.`);
  }
  // Already running (e.g. the start was sent twice): keep the original start time.
  if (isLive(trip)) return res.json({ success: true, data: trip });
  // A trip prepared in the morning can't be started as the pick-up after
  // noon (or the other way round): the app refreshes to the current run.
  if (trip.session && trip.session !== sessionFor(null)) {
    throw refuseTrip(
      res,
      409,
      'RUN_CHANGED',
      `It is now the ${runWords(sessionFor(null)).name} time. Pull down to refresh, then start the ${runWords(sessionFor(null)).name}.`
    );
  }
  trip.status = 'In Progress';
  trip.startedAt = new Date();
  trip.departureTime = timeNow();
  trip.timeline.push({
    time: trip.departureTime,
    title: 'Trip started',
    description: 'Departure from main bus lot, vehicle check passed.',
  });
  await trip.save();
  await Bus.findByIdAndUpdate(trip.bus, { status: 'Active', gpsSignal: 'ok' });

  emitToSchool(req.app.get('io'), req.school, 'trip:started', { tripId: trip._id, busId: trip.bus });
  const { routeName, plate } = await describeTrip(trip);
  await notify({
    type: 'trip_started',
    title: `${routeName} trip started`,
    message: `${trip.tripCode}${plate ? ` on bus ${plate}` : ''} left at ${trip.departureTime}, driven by ${req.driver.firstName} ${req.driver.lastName}.`,
    link: `/live-tracking/${trip._id}`,
    dedupeKey: `trip_started:${trip._id}`,
  });
  res.json({ success: true, data: trip });
});

// @desc    End a trip
// @route   POST /api/driver-app/trips/:id/end
export const endTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  // Ended already (e.g. the end was sent twice): answer with the trip as it is.
  if (trip.status === 'Completed') {
    const done = await Trip.findById(trip._id).populate(STUDENT_FOR_DRIVER);
    return res.json({ success: true, data: done });
  }
  if (!isLive(trip)) {
    throw refuseTrip(res, 409, 'TRIP_NOT_LIVE', trip.status === 'Cancelled' ? 'This trip was cancelled.' : 'Start the trip before ending it.');
  }
  trip.status = 'Completed';
  // (The bus assistant's link stops working now that the trip has ended; the
  // pass is kept so the page can say "This trip has ended".)
  trip.endedAt = new Date();
  trip.arrivalTime = timeNow();
  if (trip.startedAt) {
    trip.durationMinutes = Math.max(1, Math.round((trip.endedAt - trip.startedAt) / 60000));
  }
  await trip.save();
  await Bus.findByIdAndUpdate(trip.bus, { status: 'Idle' });

  emitToSchool(req.app.get('io'), req.school, 'trip:ended', { tripId: trip._id, busId: trip.bus });
  {
    const { routeName } = await describeTrip(trip);
    const roster = trip.studentProgress.length;
    const carried = trip.studentProgress.filter((p) => ['On board', 'Dropped off'].includes(p.dropoffStatus)).length;
    const missed = trip.studentProgress.filter((p) => p.dropoffStatus === 'Not on board').length;
    const absent = trip.studentProgress.filter((p) => p.attendance === 'Absent').length;
    const parts = [`${carried} of ${roster} students carried`];
    if (absent) parts.push(`${absent} absent`);
    if (missed) parts.push(`${missed} not on board`);
    await notify({
      type: 'trip_completed',
      title: `${routeName} trip completed`,
      message: `${trip.tripCode}${trip.durationMinutes ? ` took ${trip.durationMinutes} min` : ''}: ${parts.join(', ')}.`,
      link: `/trip-history/${trip._id}`,
      dedupeKey: `trip_completed:${trip._id}`,
    });
  }

  const populated = await Trip.findById(trip._id).populate(STUDENT_FOR_DRIVER);
  res.json({ success: true, data: populated });
});

// @desc    Push a GPS location update while a trip is in progress
// @route   POST /api/driver-app/trips/:id/location
export const pushLocation = asyncHandler(async (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (req.body.lat === undefined || req.body.lng === undefined || req.body.lat === null || req.body.lng === null) {
    res.status(400);
    throw new Error('lat and lng are required');
  }
  if (!inGhana(lat, lng)) {
    res.status(400);
    throw new Error('That position is not in Ghana. Check that location is switched on.');
  }
  const heading = Number(req.body.heading);

  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).select(
    'status bus liveLocation locationSource driverLocation driverSeenAt assistantLocation assistantOnBus startedAt'
  );
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  if (!isLive(trip)) throw refuseTrip(res, 409, 'TRIP_NOT_LIVE', 'This trip is not running, so its position is not updated.');

  // When the phone took the reading (it may have been queued while offline).
  // Anything missing, unreadable or in the future counts as "now".
  const now = Date.now();
  const taken = req.body.recordedAt ? new Date(req.body.recordedAt).getTime() : NaN;
  const recordedAt = new Date(Number.isFinite(taken) && taken <= now + 60 * 1000 ? Math.min(taken, now) : now);
  // A reading older than the driver's last one (a late offline one) must not move the bus back.
  const lastFromDriver = trip.driverLocation?.updatedAt || (trip.locationSource !== 'assistant' ? trip.liveLocation?.updatedAt : null);
  const shown = lastFromDriver ? new Date(lastFromDriver).getTime() : 0;
  if (recordedAt.getTime() < shown) return res.json({ success: true, data: trip.liveLocation, ignored: 'older than the last position' });

  const location = {
    lat,
    lng,
    heading: Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : 0,
    updatedAt: recordedAt,
  };
  // The driver's position always wins over the bus assistant's backup
  // (services/busPosition.js). Only location fields change, so this never
  // overwrites a scan saved at the same moment.
  const { shown: isShown } = await driverReading({ trip, location, io: req.app.get('io'), school: req.school });
  res.json({ success: true, data: location, ...(isShown ? {} : { ignored: 'the bus assistant has a newer position' }) });
});

// @desc    Mark a student's attendance (pre-trip roll call) and/or boarding
//          scan (dropoffStatus) for the active trip
// @route   POST /api/driver-app/trips/:id/students/:studentId/attendance
export const markAttendance = asyncHandler(async (req, res) => {
  const { attendance, dropoffStatus } = req.body;
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  if (trip.status === 'Cancelled') throw refuseTrip(res, 409, 'TRIP_ENDED', 'This trip was cancelled.');
  if (trip.status === 'Completed' && (!trip.endedAt || Date.now() - new Date(trip.endedAt).getTime() > LATE_SCAN_GRACE_MS)) {
    throw refuseTrip(res, 409, 'TRIP_ENDED', 'This trip ended more than 2 hours ago. Ask the school office to correct it.');
  }

  const index = trip.studentProgress.findIndex((p) => String(p.student) === req.params.studentId);
  if (index === -1) {
    res.status(404);
    throw new Error('Student is not on this trip roster');
  }
  const row = trip.schema.path('studentProgress').schema;
  if (attendance && !row.path('attendance').enumValues.includes(attendance)) {
    res.status(400);
    throw new Error('Unknown attendance value');
  }
  if (dropoffStatus && !row.path('dropoffStatus').enumValues.includes(dropoffStatus)) {
    res.status(400);
    throw new Error('Unknown drop-off status');
  }
  const changes = {};
  if (attendance) changes.attendance = attendance;
  if (dropoffStatus) {
    changes.dropoffStatus = dropoffStatus;
    // Where the bus was at this step (its last position, if recent), for the trail.
    changes.scannedAt = new Date();
    const pos = trip.liveLocation;
    const fresh = pos?.updatedAt && Date.now() - new Date(pos.updatedAt).getTime() < 3 * 60 * 1000;
    changes.scanLat = fresh && Number.isFinite(pos.lat) ? pos.lat : null;
    changes.scanLng = fresh && Number.isFinite(pos.lng) ? pos.lng : null;
    // Text the parent about boarding / drop-off (or record why not).
    Object.assign(changes, (await alertForScan({ trip, row: trip.studentProgress[index], dropoffStatus, school: req.school })) || {});
  }
  // Change only this student's row. Saving the whole trip let scans sent at
  // the same moment overwrite each other. The student id in the filter makes
  // sure the row at this position is still the same student.
  const at = `studentProgress.${index}`;
  const $set = Object.fromEntries(Object.entries(changes).map(([k, v]) => [`${at}.${k}`, v]));
  const saved = await Trip.updateOne({ _id: trip._id, [`${at}.student`]: trip.studentProgress[index].student }, { $set });
  if (!saved.matchedCount) {
    res.status(409);
    throw new Error('The trip roster changed. Please try again.');
  }
  const progress = { ...trip.studentProgress[index].toObject(), ...changes };
  emitToSchool(req.app.get('io'), req.school, 'trip:studentUpdate', { tripId: trip._id, studentId: req.params.studentId, progress });

  if (dropoffStatus === 'Not on board' || attendance === 'Absent') {
    const [student, { routeName }] = await Promise.all([
      Student.findById(req.params.studentId).select('firstName lastName').lean(),
      describeTrip(trip),
    ]);
    const name = student ? `${student.firstName} ${student.lastName}` : 'A student';
    if (dropoffStatus === 'Not on board') {
      await notify({
        type: 'student_not_on_board',
        title: `${name} is not on board`,
        message: `${req.driver.firstName} ${req.driver.lastName} marked ${name} as not on board on ${routeName} (${trip.tripCode}).`,
        link: `/live-tracking/${trip._id}`,
        dedupeKey: `student_not_on_board:${trip._id}:${req.params.studentId}`,
        dedupeMinutes: 12 * 60,
      });
    }
    if (attendance === 'Absent') {
      await notify({
        type: 'student_absent',
        title: `${name} is absent`,
        message: `Marked absent at roll call on ${routeName} (${trip.tripCode}).`,
        link: `/live-tracking/${trip._id}`,
        dedupeKey: `student_absent:${trip._id}:${req.params.studentId}`,
        dedupeMinutes: 12 * 60,
      });
    }
  }
  res.json({ success: true, data: progress });
});

// @desc    Send a delay SMS broadcast to the guardians of attending students
// @route   POST /api/driver-app/trips/:id/delay-broadcast
export const sendDelayBroadcast = asyncHandler(async (req, res) => {
  const { reason, message } = req.body;
  if (!reason) {
    res.status(400);
    throw new Error('A delay reason is required');
  }

  const extra = String(message || '').trim();
  if (extra.length > DELAY_LIMITS.maxMessage) {
    res.status(400);
    throw new Error(`Keep the message to ${DELAY_LIMITS.maxMessage} characters so it fits in one SMS.`);
  }

  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).populate(
    'route',
    'name'
  );
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  if (!isLive(trip)) throw refuseTrip(res, 409, 'TRIP_NOT_LIVE', 'Delay messages can only be sent while the trip is running.');
  const sent = trip.delayBroadcasts || [];
  if (sent.length >= DELAY_LIMITS.perTrip) {
    throw refuseTrip(res, 429, 'DELAY_LIMIT', `Parents have already had ${DELAY_LIMITS.perTrip} delay messages for this trip. Call the school office instead.`);
  }
  const last = sent.length ? new Date(sent[sent.length - 1].sentAt).getTime() : 0;
  const waitMs = last + DELAY_LIMITS.minMinutesApart * 60 * 1000 - Date.now();
  if (waitMs > 0) {
    throw refuseTrip(res, 429, 'DELAY_TOO_SOON', `A delay message was sent a few minutes ago. You can send another in ${Math.ceil(waitMs / 60000)} min.`);
  }

  // Only parents still waiting on this run: not those whose child is already
  // picked up / dropped (utils/sessions.js delayAffects).
  const attendingIds = trip.studentProgress.filter((p) => delayAffects(p, trip.session)).map((p) => p.student);

  const students = await Student.find({ _id: { $in: attendingIds } }).populate('primaryGuardian', 'phone');
  const guardianPhones = [...new Set(students.map((s) => s.primaryGuardian?.phone).filter(Boolean))];

  const smsText = `AwaBus: ${trip.route?.name || 'Your route'}${trip.session ? ` (${runWords(trip.session).name})` : ''} is running late. ${extra}`.trim();

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    guardianPhones.map(async (phone) => {
      try {
        const result = await sendMessage({ to: phone, text: smsText, purpose: 'delay_broadcast', school: req.school });
        if (result?.status === 'failed') failed += 1;
        else delivered += 1;
      } catch {
        failed += 1;
      }
    })
  );

  const broadcast = {
    reason,
    message: extra,
    sentAt: new Date(),
    recipientCount: guardianPhones.length,
    deliveredCount: delivered,
    failedCount: failed,
    by: req.assistant?.label || '',
  };
  trip.delayBroadcasts.push(broadcast);
  trip.status = trip.status === 'In Progress' ? 'Delayed' : trip.status;
  await trip.save();

  await notify({
    type: 'trip_delayed',
    title: `${trip.route?.name || 'A route'} is running late`,
    message: `${req.driver.firstName} ${req.driver.lastName} reported a delay on ${trip.tripCode}: ${reason}${message ? ` - ${message}` : ''}.`,
    link: `/live-tracking/${trip._id}`,
    dedupeKey: `trip_delayed:${trip._id}`,
  });

  res.status(201).json({ success: true, data: broadcast, preview: smsText });
});

// @desc    List past trips for the logged-in driver
// @route   GET /api/driver-app/trips
export const getTripHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 10);
  const filter = { driver: req.driver._id, status: { $in: ['Completed', 'Cancelled'] } };

  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .populate('route', 'routeId name')
      .populate('bus', 'plateNumber name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Trip.countDocuments(filter),
  ]);

  res.json({ success: true, data: trips, meta: buildPaginationMeta(total, page, limit) });
});

// @desc    The driver's notifications (newest first), worked out from their
//          own records: licence expiry, new bus/route, trips AwaBus ended for
//          them, and delay texts that did not reach every parent.
// @route   GET /api/driver-app/notifications
// Driver-app notifications cover the last 30 days; deleted ones are hidden.
const NOTIFICATION_DAYS = 30;

async function buildDriverNotifications(driverId) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const since = new Date(now - NOTIFICATION_DAYS * day);
  const items = [];

  const driver = await Driver.findById(driverId)
    .select('licenseExpiry assignmentHistory dismissedNotifications')
    .populate('assignmentHistory.bus', 'plateNumber')
    .populate('assignmentHistory.route', 'name')
    .lean();

  if (driver?.licenseExpiry) {
    const expiry = new Date(driver.licenseExpiry);
    const daysLeft = Math.ceil((expiry.getTime() - now) / day);
    if (daysLeft <= 30) {
      items.push({
        id: `license:${expiry.toISOString().slice(0, 10)}`,
        type: daysLeft < 0 ? 'danger' : 'warning',
        title: daysLeft < 0 ? 'Your driving licence has expired' : 'Your driving licence expires soon',
        message:
          daysLeft < 0
            ? `It expired on ${expiry.toDateString()}. Renew it and give the new details to the school office.`
            : `It expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${expiry.toDateString()}). Renew it in good time.`,
        // When it became news: the day it expired, or the day it entered the last 30 days.
        at: new Date(Math.min(now, daysLeft < 0 ? expiry.getTime() : expiry.getTime() - 30 * day)),
      });
    }
  }

  (driver?.assignmentHistory || [])
    .filter((a) => a.from && new Date(a.from) >= since)
    .forEach((a) => {
      items.push({
        id: `assignment:${new Date(a.from).getTime()}`,
        type: 'info',
        title: 'New bus assignment',
        message: `You now drive ${a.bus?.plateNumber || 'a new bus'}${a.route?.name ? ` on ${a.route.name}` : ''}.`,
        at: a.from,
      });
    });

  const [autoEnded, delayed] = await Promise.all([
    Trip.find({ driver: driverId, autoEnded: true, endedAt: { $gte: since } }).select('tripCode endedAt').lean(),
    Trip.find({ driver: driverId, 'delayBroadcasts.sentAt': { $gte: since } }).select('tripCode delayBroadcasts').lean(),
  ]);
  autoEnded.forEach((t) => {
    items.push({
      id: `autoended:${t._id}`,
      type: 'warning',
      title: 'A trip was ended for you',
      message: `${t.tripCode} was still running hours later, so AwaBus ended it. Remember to tap End trip when you finish.`,
      at: t.endedAt,
    });
  });
  delayed.forEach((t) => {
    (t.delayBroadcasts || [])
      .filter((b) => b.failedCount > 0 && new Date(b.sentAt) >= since)
      .forEach((b) => {
        items.push({
          id: `delayfail:${t._id}:${new Date(b.sentAt).getTime()}`,
          type: 'warning',
          title: 'Some parents did not get your delay text',
          message: `${b.failedCount} of ${b.recipientCount} messages for ${t.tripCode} could not be delivered. Tell the school office.`,
          at: b.sentAt,
        });
      });
  });

  const dismissed = new Set((driver?.dismissedNotifications || []).map((d) => d.id));
  return items.filter((n) => !dismissed.has(n.id)).sort((a, b) => new Date(b.at) - new Date(a.at));
}

// @desc    The driver's notifications (last 30 days, minus deleted ones)
// @route   GET /api/driver-app/notifications
export const getDriverNotifications = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await buildDriverNotifications(req.driver._id) });
});

// @desc    Delete driver-app notifications   body: { ids: [...] } or { all: true }
// @route   POST /api/driver-app/notifications/delete
export const deleteDriverNotifications = asyncHandler(async (req, res) => {
  let ids;
  if (req.body?.all === true) {
    ids = (await buildDriverNotifications(req.driver._id)).map((n) => n.id);
  } else {
    ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === 'string' && id.length <= 120).slice(0, 200) : [];
    if (!ids.length) {
      res.status(400);
      throw new Error('Choose the notifications to delete');
    }
  }
  const cutoff = Date.now() - NOTIFICATION_DAYS * 24 * 60 * 60 * 1000;
  const driver = await Driver.findById(req.driver._id).select('dismissedNotifications').lean();
  const kept = (driver?.dismissedNotifications || []).filter((d) => new Date(d.at).getTime() >= cutoff && !ids.includes(d.id));
  await Driver.updateOne(
    { _id: req.driver._id },
    { $set: { dismissedNotifications: [...kept, ...ids.map((id) => ({ id, at: new Date() }))] } }
  );
  res.json({ success: true, deleted: ids.length, data: await buildDriverNotifications(req.driver._id) });
});

// @desc    Get a single past trip's detail for the logged-in driver
// @route   GET /api/driver-app/trips/:id
export const getTripByIdForDriver = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id })
    .populate('route', 'routeId name stops morningStartTime eveningStartTime')
    .populate('bus', 'plateNumber name')
    .populate(STUDENT_FOR_DRIVER);
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  res.json({ success: true, data: trip });
});

// @desc    List past delay broadcasts sent by the logged-in driver
// @route   GET /api/driver-app/broadcasts
export const getBroadcastHistory = asyncHandler(async (req, res) => {
  const trips = await Trip.find({ driver: req.driver._id, 'delayBroadcasts.0': { $exists: true } })
    .populate('route', 'routeId name')
    .sort({ date: -1 })
    .select('tripCode route date delayBroadcasts');

  const broadcasts = trips
    .flatMap((trip) =>
      trip.delayBroadcasts.map((b) => ({
        tripId: trip._id,
        tripCode: trip.tripCode,
        route: trip.route,
        date: trip.date,
        ...b.toObject(),
      }))
    )
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  res.json({ success: true, data: broadcasts });
});

// ---------------------------------------------------------------------------
// Forgot password (phone-based, mirrors the admin OTP flow against Driver)
// ---------------------------------------------------------------------------

// @desc    Request an OTP to begin the driver password reset flow
// @route   POST /api/driver-app/auth/forgot-password
export const driverForgotPassword = asyncHandler(async (req, res) => {
  const phone = normalizeGhanaPhone(req.body.phone);
  if (!phone) {
    res.status(400);
    throw new Error('Phone number is required');
  }

  const driver = await findDriverByPhone(phone);
  if (!driver) {
    res.json({ success: true, message: 'If that phone number exists, an OTP has been sent.' });
    return;
  }

  const code = generateOtpCode();
  // Only the newest code works.
  await OtpToken.updateMany({ phone, purpose: 'driver_password_reset', consumed: false }, { consumed: true });
  await OtpToken.create({
    phone,
    code,
    purpose: 'driver_password_reset',
    expiresAt: getOtpExpiry(),
  });
  if (!(await sendOtpSms(phone, code, { purpose: 'driver_password_reset', school: driver.school }))) {
    res.status(502);
    throw new Error("We couldn't send the code right now. Please try again in a few minutes.");
  }

  res.json({ success: true, message: 'A 6-digit verification code has been sent.' });
});

// @desc    Verify the OTP sent to the driver's phone
// @route   POST /api/driver-app/auth/verify-otp
export const driverVerifyOtp = asyncHandler(async (req, res) => {
  const phone = normalizeGhanaPhone(req.body.phone);
  const { code } = req.body;
  if (!phone || !code) {
    res.status(400);
    throw new Error('Phone number and code are required');
  }

  const otp = await OtpToken.findOne({
    phone,
    purpose: 'driver_password_reset',
    consumed: false,
  }).sort({ createdAt: -1 });

  if (!otp) {
    res.status(400);
    throw new Error("Didn't receive a code? Request a new OTP.");
  }
  if (otp.expiresAt < new Date()) {
    res.status(400);
    throw new Error('The code has expired');
  }
  // Same rule as the admin flow: after 5 wrong codes this code is dead.
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    otp.consumed = true;
    await otp.save();
    res.status(429);
    throw new Error('Too many incorrect attempts. Request a new code.');
  }
  if (otp.code !== String(code)) {
    otp.attempts += 1;
    await otp.save();
    res.status(400);
    throw new Error(
      otp.attempts >= MAX_OTP_ATTEMPTS
        ? 'Too many incorrect attempts. Request a new code.'
        : 'Invalid OTP. Please try again.'
    );
  }

  otp.consumed = true;
  await otp.save();

  const resetToken = signResetToken({ phone, purpose: 'driver_password_reset' }, await findDriverByPhone(phone));

  res.json({ success: true, resetToken });
});

// @desc    Resend a fresh OTP
// @route   POST /api/driver-app/auth/resend-otp
export const driverResendOtp = asyncHandler(async (req, res) => {
  const phone = normalizeGhanaPhone(req.body.phone);
  if (!phone) {
    res.status(400);
    throw new Error('Phone number is required');
  }
  // Only text numbers that belong to a driver: otherwise anyone could make the
  // platform send (and pay for) SMS to any number. Same reply either way.
  const driver = await findDriverByPhone(phone);
  if (!driver) {
    res.json({ success: true, message: 'A new verification code has been sent.' });
    return;
  }
  const code = generateOtpCode();
  await OtpToken.updateMany({ phone, purpose: 'driver_password_reset', consumed: false }, { consumed: true });
  await OtpToken.create({ phone, code, purpose: 'driver_password_reset', expiresAt: getOtpExpiry() });
  if (!(await sendOtpSms(phone, code, { purpose: 'driver_password_reset', school: driver.school }))) {
    res.status(502);
    throw new Error("We couldn't send the code right now. Please try again in a few minutes.");
  }
  res.json({ success: true, message: 'A new verification code has been sent.' });
});

// @desc    Reset a driver's password using a verified reset token
// @route   POST /api/driver-app/auth/reset-password
export const driverResetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    res.status(400);
    throw new Error('Reset token and new password are required');
  }

  const read = readResetToken(resetToken, (p) => findDriverByPhone(p.phone));
  if (read.error || read.payload.purpose !== 'driver_password_reset') {
    res.status(400);
    throw new Error(read.error || 'Invalid reset session');
  }
  const checked = await read.check();
  if (checked.error) {
    res.status(checked.status || 400);
    throw new Error(checked.error);
  }
  const { account: driver } = checked;

  driver.password = newPassword;
  await saveDriverAsSystem(driver);

  res.json({ success: true, message: 'You can now sign in with your new password' });
});

// @desc    A crash of the driver app on this phone (sent on the next launch)
// @route   POST /api/driver-app/crash-report
export const reportAppCrash = asyncHandler(async (req, res) => {
  const text = (v, max) => String(v || '').slice(0, max);
  const at = Number(req.body?.at);
  await AppCrash.create({
    school: req.school,
    driver: req.driver._id,
    message: text(req.body?.message, 500),
    stack: text(req.body?.stack, 6000),
    native: Boolean(req.body?.native),
    code: text(req.body?.code, 80),
    happenedAt: Number.isFinite(at) ? new Date(at) : null,
  });
  console.error(`[app crash] driver ${req.driver._id}: ${text(req.body?.message, 200)}`);
  res.status(201).json({ success: true });
});

/** Photos of the students on a trip, { studentId: photo }, only those with one. */
export async function tripPhotos(tripId) {
  const trip = await Trip.findById(tripId).select('studentProgress.student').lean();
  const ids = (trip?.studentProgress || []).map((r) => r.student);
  const students = await Student.find({ _id: { $in: ids }, profilePhotoUrl: { $nin: ['', null] } }).select('profilePhotoUrl').lean();
  return Object.fromEntries(students.map((s) => [String(s._id), s.profilePhotoUrl]));
}

// @desc    Students' photos for a trip, fetched once per trip by the app (kept
//          out of the trip data, which the app refreshes every few seconds)
// @route   GET /api/driver-app/trips/:id/photos
export const getTripPhotos = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).select('_id').lean();
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  res.set('Cache-Control', 'private, max-age=600');
  res.json({ success: true, data: await tripPhotos(trip._id) });
});
