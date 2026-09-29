import asyncHandler from 'express-async-handler';
import Bus from '../models/Bus.js';
import School from '../models/School.js';
import { tenantContext } from '../utils/tenantContext.js';
import Trip from '../models/Trip.js';
import { closeStaleTrips, LIVE_TRIP_FILTER } from '../services/staleTrips.js';
import { assistantsWithStatus } from '../services/assistPass.js';
import { assistantLocationState } from '../services/busPosition.js';

const statusFromBus = (bus) => {
  if (bus.gpsSignal === 'lost') return 'GPS Signal Lost';
  if (bus.status === 'Active') return 'Active';
  if (bus.status === 'Maintenance') return 'Offline';
  return bus.gpsSignal === 'offline' ? 'Offline' : 'Idle';
};

// @desc    Live tracking overview: every bus with an in-progress trip today plus its last known GPS fix.
// @route   GET /api/tracking/overview
export const getTrackingOverview = asyncHandler(async (req, res) => {
  // Don't show trips the driver forgot to end as live (the sweeper also does
  // this every 10 minutes; doing it here keeps this screen right in between).
  await closeStaleTrips();
  const trips = await Trip.find(LIVE_TRIP_FILTER)
    .populate('route', 'routeId name')
    .populate('bus', 'plateNumber name capacity lastKnownLocation gpsSignal status locationSeenAt locationOffAt')
    .populate('driver', 'firstName lastName phone lastSeenAt signedOutAt');

  const buses = trips
    .filter((t) => t.bus)
    .map((t) => ({
      tripId: t._id,
      tripCode: t.tripCode,
      bus: t.bus,
      route: t.route,
      driver: t.driver,
      status: t.status,
      gpsSignal: t.gpsSignal,
      liveLocation: t.liveLocation,
      etaMinutes: t.etaMinutes,
      distanceCoveredKm: t.distanceCoveredKm,
      departureTime: t.departureTime,
      session: t.session,
      // Online / offline: the driver's app reaching the school (mobile data)
      // and the bus's location being read (location on).
      driverOnline: Boolean(t.driver?.online),
      busOnline: Boolean(t.bus?.online),
      // 'assistant' while the bus assistant's phone covers for the driver's.
      locationSource: t.locationSource || 'driver',
      // The bus assistant (teacher) helping on this trip: connected or not.
      assistants: assistantsWithStatus(t),
      // Their "Share my location as backup" switch: off / standing by / covering...
      assistantLocation: assistantLocationState(t),
      assistantName: t.assistantLocation?.name || '',
      driverSeenAt: t.driverSeenAt,
    }));

  const counts = {
    all: buses.length,
    active: buses.filter((b) => b.status === 'In Progress' && b.gpsSignal === 'ok').length,
    delayed: buses.filter((b) => b.status === 'Delayed').length,
    offline: buses.filter((b) => b.gpsSignal !== 'ok').length,
  };

  // The school on the map (and its arrival zone), when its location is set.
  const school = await tenantContext.runAsSystem(() => School.findById(req.school).select('name lat lng arrivalRadius').lean());
  const schoolPlace = school && Number.isFinite(school.lat) && Number.isFinite(school.lng)
    ? { name: school.name, lat: school.lat, lng: school.lng, radius: school.arrivalRadius || 150 }
    : null;
  res.json({ success: true, data: buses, counts, school: schoolPlace });
});

// @desc    Where a bus has been on a trip, and where / when each child was
//          picked up or dropped (the trail on Live Tracking)
// @route   GET /api/tracking/trips/:tripId/trail
export const getTrackingTrail = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.tripId)
    .select('+path session studentProgress')
    .populate('studentProgress.student', 'firstName lastName')
    .lean();
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  const events = (trip.studentProgress || [])
    .filter((r) => r.scannedAt && Number.isFinite(r.scanLat) && Number.isFinite(r.scanLng) && ['On board', 'Dropped off', 'Not on board'].includes(r.dropoffStatus))
    .map((r) => ({
      studentId: r.student?._id,
      name: r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Student',
      status: r.dropoffStatus,
      at: r.scannedAt,
      lat: r.scanLat,
      lng: r.scanLng,
    }));
  res.json({ success: true, data: { session: trip.session, path: trip.path || [], events } });
});

// @desc    Live trip detail for a single bus (drives the "Trip Detail" tracking sub-view)
// @route   GET /api/tracking/trips/:tripId
export const getTrackingTripDetail = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.tripId)
    .populate('route', 'routeId name stops')
    .populate('bus', 'plateNumber name capacity lastKnownLocation gpsSignal locationSeenAt locationOffAt')
    .populate('driver', 'firstName lastName phone lastSeenAt signedOutAt')
    .populate('studentProgress.student', 'firstName lastName studentCode');

  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  const data = trip.toObject();
  data.driverOnline = Boolean(trip.driver?.online);
  data.busOnline = Boolean(trip.bus?.online);
  data.assistantLocationState = assistantLocationState(trip);
  res.json({ success: true, data });
});
