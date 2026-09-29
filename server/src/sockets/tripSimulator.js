// Lightweight demo GPS simulator.
//
// The real GPS stream is expected to come from the AwaBus driver app (see
// /api/driver-app/trips/:id/location). Since that app's UI doesn't exist yet,
// this simulator nudges buses with an "In Progress" trip along their route's
// stops so the Live Tracking screen has something live to show out of the box.
// It is off unless TRIP_SIMULATOR=true (see simulatorEnabled).

import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import { tenantContext } from '../utils/tenantContext.js';
import { LIVE_TRIP_FILTER } from '../services/staleTrips.js';
import { emitToSchool } from './rooms.js';

const progressByTrip = new Map();

// Shown on the System page. The simulator moves buses on any in-progress trip,
// so it should be off once real driver-app GPS is used.
export const simulatorStatus = { running: false, intervalMs: 0, lastRunAt: null, lastError: null, lastErrorAt: null };

const lerp = (a, b, t) => a + (b - a) * t;

// Off unless TRIP_SIMULATOR=true: it moves every live bus along its stops, which
// would overwrite real positions from the driver app. For demos only.
export const simulatorEnabled = () => process.env.TRIP_SIMULATOR === 'true';

export const startTripSimulator = (io, intervalMs = 4000) => {
  if (!simulatorEnabled()) return;
  Object.assign(simulatorStatus, { running: true, intervalMs });
  setInterval(async () => {
    simulatorStatus.lastRunAt = new Date();
    try {
      // It works across every school, so it runs as the system (it failed
      // on every tick before, with no school to scope its query to).
      const trips = await tenantContext.runAsSystem(() => Trip.find(LIVE_TRIP_FILTER).populate('route', 'stops'));

      for (const trip of trips) {
        const stops = (trip.route?.stops || []).filter((s) => s.lat && s.lng);
        if (stops.length < 2) continue;

        let progress = progressByTrip.get(String(trip._id)) ?? 0;
        progress += 0.02;
        if (progress >= 1) progress = 0;
        progressByTrip.set(String(trip._id), progress);

        const segmentCount = stops.length - 1;
        const segment = Math.min(Math.floor(progress * segmentCount), segmentCount - 1);
        const segmentT = progress * segmentCount - segment;
        const from = stops[segment];
        const to = stops[segment + 1];

        const lat = lerp(from.lat, to.lat, segmentT);
        const lng = lerp(from.lng, to.lng, segmentT);
        const heading = Math.atan2(to.lng - from.lng, to.lat - from.lat) * (180 / Math.PI);
        const location = { lat, lng, heading, updatedAt: new Date() };

        // eslint-disable-next-line no-await-in-loop
        await tenantContext.runAsSystem(async () => {
          await Trip.updateOne({ _id: trip._id }, { $set: { liveLocation: location, gpsSignal: 'ok' } });
          await Bus.updateOne({ _id: trip.bus }, { $set: { lastKnownLocation: location, gpsSignal: 'ok' } });
        });

        emitToSchool(io, trip.school, 'bus:location', { tripId: trip._id, busId: trip.bus, location });
      }
    } catch (err) {
      Object.assign(simulatorStatus, { lastError: err.message, lastErrorAt: new Date() });
      console.error('[tripSimulator] error:', err.message);
    }
  }, intervalMs);
};
