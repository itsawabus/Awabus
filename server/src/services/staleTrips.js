import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import { tenantContext } from '../utils/tenantContext.js';

// A school run takes an hour or two. A trip still "In Progress" this long after
// it started, with no location from the bus for a while, was never ended by
// its driver (app closed, phone died, ...).
export const STALE_TRIP_HOURS = 6;
// ...unless the bus is clearly still out: the driver's phone (or the bus
// assistant's, as backup) sent a location this recently.
export const STILL_ACTIVE_MINUTES = 30;
const SWEEP_EVERY_MS = 10 * 60 * 1000;

// A trip that is really still running: live status and never finished. Old
// "Delayed" trips that did arrive (arrivalTime/endedAt set) are finished trips
// that ran late, not live ones.
export const LIVE_TRIP_FILTER = {
  status: { $in: ['In Progress', 'Delayed'] },
  endedAt: null,
  arrivalTime: { $in: ['', null] },
};

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/**
 * End trips that were left "In Progress"/"Delayed" for longer than
 * STALE_TRIP_HOURS, so they stop showing as live. They are marked autoEnded so
 * Trip History can say the driver did not end them. Runs for the school in the
 * current tenant context, or for every school inside runAsSystem.
 */
export async function closeStaleTrips() {
  const cutoff = new Date(Date.now() - STALE_TRIP_HOURS * 60 * 60 * 1000);
  const recent = new Date(Date.now() - STILL_ACTIVE_MINUTES * 60 * 1000);
  const trips = await Trip.find({
    ...LIVE_TRIP_FILTER,
    $and: [
      { $or: [{ startedAt: { $lt: cutoff } }, { startedAt: null, date: { $lt: cutoff } }] },
      { $or: [{ driverSeenAt: null }, { driverSeenAt: { $lt: recent } }] },
      { $or: [{ 'assistantLocation.updatedAt': null }, { 'assistantLocation.updatedAt': { $lt: recent } }] },
    ],
  });

  for (const trip of trips) {
    trip.status = 'Completed';
    trip.autoEnded = true;
    trip.endedAt = new Date();
    trip.gpsSignal = 'offline';
    trip.timeline.push({
      time: timeNow(),
      title: 'Ended automatically',
      description: `The driver did not end this trip, so AwaBus ended it after more than ${STALE_TRIP_HOURS} hours. Student statuses are as the driver last recorded them.`,
    });
    // eslint-disable-next-line no-await-in-loop
    await trip.save();
    // eslint-disable-next-line no-await-in-loop
    const stillLive = await Trip.exists({ ...LIVE_TRIP_FILTER, bus: trip.bus });
    // eslint-disable-next-line no-await-in-loop
    if (!stillLive) await Bus.updateOne({ _id: trip.bus, status: 'Active' }, { status: 'Idle', gpsSignal: 'offline' });
  }
  return trips.length;
}

// Shown on the System page.
export const sweeperStatus = { running: false, everyMinutes: SWEEP_EVERY_MS / 60000, lastRunAt: null, lastEnded: 0, totalEnded: 0, lastError: null };

/** Sweep every school on start-up and then every 10 minutes. */
export function startStaleTripSweeper() {
  sweeperStatus.running = true;
  const sweep = () =>
    tenantContext
      .runAsSystem(closeStaleTrips)
      .then((n) => {
        Object.assign(sweeperStatus, { lastRunAt: new Date(), lastEnded: n, lastError: null });
        sweeperStatus.totalEnded += n;
        if (n) console.log(`[trips] ended ${n} trip(s) left in progress for over ${STALE_TRIP_HOURS} hours`);
      })
      .catch((err) => {
        Object.assign(sweeperStatus, { lastRunAt: new Date(), lastError: err.message });
        console.error('[trips] could not end stale trips:', err.message);
      });
  sweep();
  return setInterval(sweep, SWEEP_EVERY_MS);
}
