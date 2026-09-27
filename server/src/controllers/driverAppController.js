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
import generateToken from '../utils/generateToken.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { nextSequentialCode } from '../utils/idGenerator.js';
import { generateOtpCode, sendOtpSms, sendSms, getOtpExpiry } from '../utils/otp.js';
import { tenantContext } from '../utils/tenantContext.js';
import { notify, describeTrip } from '../services/notify.js';

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
  const { password } = req.body;
  if (!phone || !password) {
    res.status(400);
    throw new Error('Phone number and password are required');
  }

  const driver = await findDriverByPhone(phone, true);

  if (!driver) {
    res.status(404);
    throw new Error('No driver account found with this phone number');
  }

  if (driver.password) {
    res.status(400);
    throw new Error('This account already has a password set');
  }

  driver.password = password;
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

// Builds today's trip document for a driver on the fly the first time it's
// requested, from whatever bus/route they're currently assigned. This means
// the driver app works without an admin having to manually schedule a trip
// every day first.
const provisionTodaysTrip = async (driver, dayStart, dayEnd) => {
  if (!driver.assignedBus || !driver.assignedRoute) return null;

  const route = await RouteModel.findById(driver.assignedRoute).populate('students', '_id');
  if (!route) return null;

  const tripCode = await nextSequentialCode(Trip, 'tripCode', 'TRP-', 4);

  const trip = await Trip.create({
    tripCode,
    route: route._id,
    bus: driver.assignedBus,
    driver: driver._id,
    date: dayStart,
    status: 'Scheduled',
    stops: route.stops,
    studentProgress: (route.students || []).map((s) => ({
      student: s._id,
      attendance: 'Present',
      dropoffStatus: 'Pending',
    })),
  });

  return Trip.findById(trip._id)
    .populate('route', 'routeId name stops')
    .populate('bus', 'plateNumber name capacity')
    .populate('studentProgress.student', 'firstName lastName studentCode');
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

  const route = await RouteModel.findById(trip.route._id).populate('students', '_id');
  if (!route) return trip;

  const currentIds = new Set((route.students || []).map((s) => String(s._id)));
  const existingIds = new Set(trip.studentProgress.map((p) => String(p.student?._id || p.student)));

  const sameMembership =
    currentIds.size === existingIds.size && [...currentIds].every((id) => existingIds.has(id));
  if (sameMembership) return trip;

  // Rebuild as plain objects (not populated subdocuments) and write via
  // findByIdAndUpdate rather than mutating + saving the populated `trip`
  // document directly — keeps this from depending on how Mongoose casts an
  // already-populated path back down when reassigned.
  const kept = trip.studentProgress
    .filter((p) => currentIds.has(String(p.student?._id || p.student)))
    .map((p) => ({
      student: p.student?._id || p.student,
      attendance: p.attendance,
      alertStatus: p.alertStatus,
      alertTime: p.alertTime,
      dropoffStatus: p.dropoffStatus,
    }));
  const added = [...currentIds]
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ student: id, attendance: 'Present', dropoffStatus: 'Pending' }));

  await Trip.findByIdAndUpdate(trip._id, { studentProgress: [...kept, ...added] });
  return Trip.findById(trip._id)
    .populate('route', 'routeId name stops')
    .populate('bus', 'plateNumber name capacity')
    .populate('studentProgress.student', 'firstName lastName studentCode');
};

// @desc    Get today's scheduled/active trip for the logged-in driver
//          (auto-creates one from the driver's current assignment if missing)
// @route   GET /api/driver-app/trips/today
export const getTodaysTrip = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  let trip = await Trip.findOne({
    driver: req.driver._id,
    date: { $gte: start, $lte: end },
  })
    .populate('route', 'routeId name stops')
    .populate('bus', 'plateNumber name capacity')
    .populate('studentProgress.student', 'firstName lastName studentCode');

  if (!trip) {
    trip = await provisionTodaysTrip(req.driver, start, end);
  } else {
    trip = await reconcileStudentProgress(trip);
  }

  res.json({ success: true, data: trip });
});

// @desc    Start a trip
// @route   POST /api/driver-app/trips/:id/start
export const startTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
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

  req.app.get('io')?.emit('trip:started', { tripId: trip._id, busId: trip.bus });
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
  trip.status = 'Completed';
  trip.endedAt = new Date();
  trip.arrivalTime = timeNow();
  if (trip.startedAt) {
    trip.durationMinutes = Math.max(1, Math.round((trip.endedAt - trip.startedAt) / 60000));
  }
  await trip.save();
  await Bus.findByIdAndUpdate(trip.bus, { status: 'Idle' });

  req.app.get('io')?.emit('trip:ended', { tripId: trip._id, busId: trip.bus });
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

  const populated = await Trip.findById(trip._id).populate('studentProgress.student', 'firstName lastName studentCode');
  res.json({ success: true, data: populated });
});

// @desc    Push a GPS location update while a trip is in progress
// @route   POST /api/driver-app/trips/:id/location
export const pushLocation = asyncHandler(async (req, res) => {
  const { lat, lng, heading } = req.body;
  if (lat === undefined || lng === undefined) {
    res.status(400);
    throw new Error('lat and lng are required');
  }

  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id });
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  const location = { lat, lng, heading: heading || 0, updatedAt: new Date() };
  trip.liveLocation = location;
  trip.gpsSignal = 'ok';
  await trip.save();
  await Bus.findByIdAndUpdate(trip.bus, { lastKnownLocation: location, gpsSignal: 'ok' });

  req.app.get('io')?.emit('bus:location', { tripId: trip._id, busId: trip.bus, location });
  res.json({ success: true, data: location });
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

  const progress = trip.studentProgress.find((p) => String(p.student) === req.params.studentId);
  if (!progress) {
    res.status(404);
    throw new Error('Student is not on this trip roster');
  }
  if (attendance) progress.attendance = attendance;
  if (dropoffStatus) {
    progress.dropoffStatus = dropoffStatus;
    progress.alertStatus = 'Alert sent';
    progress.alertTime = timeNow();
  }

  await trip.save();
  req.app.get('io')?.emit('trip:studentUpdate', { tripId: trip._id, studentId: req.params.studentId, progress });

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

  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id }).populate(
    'route',
    'name'
  );
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  const attendingIds = trip.studentProgress
    .filter((p) => p.attendance === 'Present')
    .map((p) => p.student);

  const students = await Student.find({ _id: { $in: attendingIds } }).populate('primaryGuardian', 'phone');
  const guardianPhones = [...new Set(students.map((s) => s.primaryGuardian?.phone).filter(Boolean))];

  const smsText = `AwaBus: ${trip.route?.name || 'Your route'} is running late. ${message || ''}`.trim();

  let delivered = 0;
  let failed = 0;
  await Promise.all(
    guardianPhones.map(async (phone) => {
      try {
        await sendSms(phone, smsText);
        delivered += 1;
      } catch {
        failed += 1;
      }
    })
  );

  const broadcast = {
    reason,
    message: message || '',
    sentAt: new Date(),
    recipientCount: guardianPhones.length,
    deliveredCount: delivered,
    failedCount: failed,
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

// @desc    Get a single past trip's detail for the logged-in driver
// @route   GET /api/driver-app/trips/:id
export const getTripByIdForDriver = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, driver: req.driver._id })
    .populate('route', 'routeId name stops')
    .populate('bus', 'plateNumber name')
    .populate('studentProgress.student', 'firstName lastName studentCode');
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
  await OtpToken.create({
    phone,
    code,
    purpose: 'driver_password_reset',
    expiresAt: getOtpExpiry(),
  });
  await sendOtpSms(phone, code);

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
  if (otp.code !== code) {
    otp.attempts += 1;
    await otp.save();
    res.status(400);
    throw new Error('Invalid OTP. Please try again.');
  }

  otp.consumed = true;
  await otp.save();

  const resetToken = jwt.sign({ phone, purpose: 'driver_password_reset' }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });

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
  const code = generateOtpCode();
  await OtpToken.create({ phone, code, purpose: 'driver_password_reset', expiresAt: getOtpExpiry() });
  await sendOtpSms(phone, code);
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

  let payload;
  try {
    payload = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch {
    res.status(400);
    throw new Error('Reset session expired. Please restart the password reset process.');
  }
  if (payload.purpose !== 'driver_password_reset') {
    res.status(400);
    throw new Error('Invalid reset session');
  }

  const driver = await findDriverByPhone(payload.phone);
  if (!driver) {
    res.status(404);
    throw new Error('Account not found');
  }

  driver.password = newPassword;
  await saveDriverAsSystem(driver);

  res.json({ success: true, message: 'You can now sign in with your new password' });
});
