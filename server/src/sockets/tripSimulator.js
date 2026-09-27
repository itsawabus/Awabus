// Lightweight demo GPS simulator.
//
// The real GPS stream is expected to come from the AwaBus driver app (see
// /api/driver-app/trips/:id/location). Since that app's UI doesn't exist yet,
// this simulator nudges buses with an "In Progress" trip along their route's
// stops so the Live Tracking screen has something live to show out of the box.
// It is safe to delete once real driver app traffic exists.

import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';

const progressByTrip = new Map();

const lerp = (a, b, t) => a + (b - a) * t;

export const startTripSimulator = (io, intervalMs = 4000) => {
  setInterval(async () => {
    try {
      const trips = await Trip.find({ status: { $in: ['In Progress', 'Delayed'] } }).populate(
        'route',
        'stops'
      );

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

        trip.liveLocation = location;
        trip.gpsSignal = 'ok';
        await trip.save();
        await Bus.findByIdAndUpdate(trip.bus, { lastKnownLocation: location, gpsSignal: 'ok' });

        io.emit('bus:location', { tripId: trip._id, busId: trip.bus, location });
      }
    } catch (err) {
      console.error('[tripSimulator] error:', err.message);
    }
  }, intervalMs);
};
