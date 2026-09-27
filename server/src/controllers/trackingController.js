import asyncHandler from 'express-async-handler';
import Bus from '../models/Bus.js';
import Trip from '../models/Trip.js';

const statusFromBus = (bus) => {
  if (bus.gpsSignal === 'lost') return 'GPS Signal Lost';
  if (bus.status === 'Active') return 'Active';
  if (bus.status === 'Maintenance') return 'Offline';
  return bus.gpsSignal === 'offline' ? 'Offline' : 'Idle';
};

// @desc    Live tracking overview: every bus with an in-progress trip today plus its last known GPS fix.
// @route   GET /api/tracking/overview
export const getTrackingOverview = asyncHandler(async (req, res) => {
  const trips = await Trip.find({ status: { $in: ['In Progress', 'Delayed'] } })
    .populate('route', 'routeId name')
    .populate('bus', 'plateNumber name capacity lastKnownLocation gpsSignal status')
    .populate('driver', 'firstName lastName phone');

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
    }));

  const counts = {
    all: buses.length,
    active: buses.filter((b) => b.status === 'In Progress' && b.gpsSignal === 'ok').length,
    delayed: buses.filter((b) => b.status === 'Delayed').length,
    offline: buses.filter((b) => b.gpsSignal !== 'ok').length,
  };

  res.json({ success: true, data: buses, counts });
});

// @desc    Live trip detail for a single bus (drives the "Trip Detail" tracking sub-view)
// @route   GET /api/tracking/trips/:tripId
export const getTrackingTripDetail = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.tripId)
    .populate('route', 'routeId name stops')
    .populate('bus', 'plateNumber name capacity lastKnownLocation gpsSignal')
    .populate('driver', 'firstName lastName phone')
    .populate('studentProgress.student', 'firstName lastName studentCode');

  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  res.json({ success: true, data: trip });
});
