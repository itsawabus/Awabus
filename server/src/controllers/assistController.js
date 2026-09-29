// Bus assistant (teacher on bus duty) endpoints, used by the assistant page
// that the driver's QR code opens. No account: every request carries the
// pass in the X-Assist-Pass header (see services/assistPass.js). Actions run
// through the same handlers as the driver app, so the same rules and limits
// apply, and they are recorded as "Bus assistant (name)".
import asyncHandler from 'express-async-handler';
import Trip from '../models/Trip.js';
import Driver from '../models/Driver.js';
import { tenantContext } from '../utils/tenantContext.js';
import { resolvePass } from '../services/assistPass.js';
import {
  STUDENT_FOR_DRIVER,
  DELAY_LIMITS,
  PARENT_MESSAGE_LIMITS,
  markAttendance,
  messageParent,
  sendDelayBroadcast,
} from './driverAppController.js';

// A name the teacher types once, kept short and plain.
const cleanName = (raw) =>
  String(raw || '')
    .replace(/[^\p{L}\p{M}\s.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

/** Checks the pass and sets up the request as the trip's driver would be. */
export const requireAssistPass = asyncHandler(async (req, res, next) => {
  const found = await resolvePass(req.get('x-assist-pass'));
  if (found.error) {
    res.status(found.status);
    const err = new Error(found.error);
    err.errorCode = found.code;
    throw err;
  }
  const { trip } = found;
  const name = cleanName(req.get('x-assistant-name')) || 'Teacher';
  await tenantContext.run(String(trip.school), async () => {
    req.assistTrip = trip;
    req.school = trip.school;
    req.assistant = { name, label: `Bus assistant (${name})` };
    // The driver handlers find the trip by its driver and word messages with
    // the actor's name; here that actor is the bus assistant.
    req.driver = { _id: trip.driver, firstName: 'Bus assistant', lastName: `(${name})` };
    // Remember who helped on this trip (once per name).
    await Trip.updateOne({ _id: trip._id, 'assistants.name': { $ne: name } }, { $push: { assistants: { name, firstSeenAt: new Date() } } });
    next();
  });
});

// Runs a driver handler for the pass's trip.
export const forPassTrip = (handler) => (req, res, next) => {
  req.params.id = String(req.assistTrip._id);
  return handler(req, res, next);
};

// @desc    The trip the pass is for: route, bus, driver and students
// @route   GET /api/assist/trip
export const getAssistTrip = asyncHandler(async (req, res) => {
  const [trip, driver] = await Promise.all([
    Trip.findById(req.assistTrip._id)
      .select('tripCode status session route bus date startedAt studentProgress delayBroadcasts parentMessages liveLocation')
      .populate('route', 'routeId name')
      .populate('bus', 'plateNumber name')
      .populate(STUDENT_FOR_DRIVER)
      .lean(),
    Driver.findById(req.assistTrip.driver).select('firstName lastName phone').lean(),
  ]);
  res.json({
    success: true,
    data: {
      ...trip,
      driver: driver ? { name: `${driver.firstName} ${driver.lastName}`, phone: driver.phone } : null,
      assistant: req.assistant.name,
      limits: { delay: DELAY_LIMITS, parentMessage: PARENT_MESSAGE_LIMITS },
    },
  });
});

export const assistMarkAttendance = forPassTrip(markAttendance);
export const assistMessageParent = forPassTrip(messageParent);
export const assistDelayBroadcast = forPassTrip(sendDelayBroadcast);
