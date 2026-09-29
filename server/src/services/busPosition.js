// Where the bus is: the driver's phone first, the bus assistant's phone as a
// backup.
//
// The driver's position is always used while it keeps arriving. When nothing
// fresh has come from the driver for DRIVER_SILENT_MS (their data dropped),
// the assistant's phone (sharing from the assistant page) takes over, until
// the driver's next fresh position. The assistant only counts while their
// phone is on the bus: whenever both phones report, they must be within
// ON_BUS_METRES of each other.
import Trip from '../models/Trip.js';
import Bus from '../models/Bus.js';
import { emitToSchool } from '../sockets/rooms.js';
import { checkGeofences, metresBetween } from './parentAlerts.js';

export const DRIVER_SILENT_MS = 45 * 1000;
export const ON_BUS_METRES = 300;
// Two readings this close in time can be compared.
export const PAIR_FRESH_MS = 60 * 1000;
// A driver reading this recent (by the phone's clock) is "live", not a
// queued one arriving late.
export const LIVE_READING_MS = 30 * 1000;
// Browser positions less accurate than this are not used for the bus.
export const MAX_ASSIST_ACCURACY_M = 150;

const recent = (date, ms, now = Date.now()) => Boolean(date) && now - new Date(date).getTime() <= ms;

// The trail: a new point once the bus has moved on this far.
export const TRAIL_STEP_METRES = 15;
export const MAX_TRAIL_POINTS = 3000;
const lastTrailPoint = new Map(); // trip id -> { lat, lng } (this server's memory)

/** Shows `location` as the bus position everywhere (map, bus status, near-home alerts). */
export async function publishBusLocation({ trip, location, source, io, school }) {
  const key = String(trip._id);
  const last = lastTrailPoint.get(key);
  const addToTrail = !last || metresBetween(last, location) >= TRAIL_STEP_METRES;
  const update = { $set: { liveLocation: location, gpsSignal: 'ok', locationSource: source } };
  if (addToTrail) {
    lastTrailPoint.set(key, { lat: location.lat, lng: location.lng });
    update.$push = { path: { $each: [{ lat: location.lat, lng: location.lng, at: location.updatedAt || new Date() }], $slice: -MAX_TRAIL_POINTS } };
  }
  await Trip.updateOne({ _id: trip._id }, update);
  await Bus.updateOne({ _id: trip.bus }, { $set: { lastKnownLocation: location, gpsSignal: 'ok', locationSeenAt: new Date() } });
  emitToSchool(io, school, 'bus:location', { tripId: trip._id, busId: trip.bus, location, source });
  // Near-home check after the reply, so the phone never waits on SMS / calls.
  setImmediate(() => checkGeofences({ tripId: trip._id, position: location, school }));
}

/** Is the assistant's phone on the bus, judging by the driver's last live reading? (null = can't tell) */
function assistantNearDriver(driverLocation, driverSeenAt, assistantLocation, now) {
  if (!driverLocation || !assistantLocation || !recent(driverSeenAt, PAIR_FRESH_MS, now)) return null;
  if (!recent(assistantLocation.updatedAt, PAIR_FRESH_MS, now)) return null;
  return metresBetween(driverLocation, assistantLocation) <= ON_BUS_METRES;
}

/**
 * A reading from the driver. Returns { shown: boolean } (false when it is an
 * old queued reading while the assistant's newer one is showing).
 */
export async function driverReading({ trip, location, io, school }) {
  const now = Date.now();
  const live = now - new Date(location.updatedAt).getTime() <= LIVE_READING_MS;
  const set = { driverLocation: location };
  if (live) set.driverSeenAt = new Date(now);
  if (live) {
    const onBus = assistantNearDriver(location, new Date(now), trip.assistantLocation, now);
    if (onBus !== null) set.assistantOnBus = onBus;
  }
  await Trip.updateOne({ _id: trip._id }, { $set: set });
  // The driver always wins, except that a late queued reading must not pull
  // the bus back while the assistant's newer position is showing.
  if (trip.locationSource === 'assistant' && !live) return { shown: false };
  await publishBusLocation({ trip, location, source: 'driver', io, school });
  return { shown: true };
}

/**
 * A reading from the assistant's phone. Returns { used, reason }:
 *   used: true  -> it is the bus position now (the driver's phone is silent)
 *   reason: 'driver_live' | 'not_on_bus' | 'weak_gps' | 'backup'
 */
export async function assistantReading({ trip, location, accuracy, name, io, school }) {
  const now = Date.now();
  const assistantLocation = { ...location, accuracy: Number.isFinite(accuracy) ? accuracy : null, name, sharing: true, stoppedAt: null };
  const set = { assistantLocation };
  const onBus = assistantNearDriver(trip.driverLocation, trip.driverSeenAt, assistantLocation, now);
  if (onBus !== null) set.assistantOnBus = onBus;
  await Trip.updateOne({ _id: trip._id }, { $set: set });

  const lastFromDriver = trip.driverSeenAt || trip.startedAt;
  if (recent(lastFromDriver, DRIVER_SILENT_MS, now)) return { used: false, reason: 'driver_live' };
  const stillOnBus = onBus !== null ? onBus : trip.assistantOnBus;
  if (stillOnBus === false) return { used: false, reason: 'not_on_bus' };
  if (Number.isFinite(accuracy) && accuracy > MAX_ASSIST_ACCURACY_M) return { used: false, reason: 'weak_gps' };
  await publishBusLocation({ trip, location, source: 'assistant', io, school });
  return { used: true, reason: 'backup' };
}

// The assistant's backup location counts as off when nothing came for this long
// (page closed, screen off, or the switch turned off without reaching us).
export const ASSIST_LOCATION_QUIET_MS = 60 * 1000;

/**
 * The bus assistant's "Share my location as backup", for the admin:
 *   { state: 'none' | 'off' | 'standby' | 'covering' | 'not_on_bus', name, at }
 *   none: never switched on on this trip; off: switched off or gone quiet;
 *   standby: on, the driver's phone is reporting; covering: showing the bus
 *   now; not_on_bus: on, but too far from the driver's phone to be used.
 */
export function assistantLocationState(trip, now = Date.now()) {
  const a = trip.assistantLocation;
  if (!a || (!a.updatedAt && !a.stoppedAt)) return { state: 'none', name: '', at: null };
  const name = a.name || '';
  if (a.sharing === false) return { state: 'off', name, at: a.stoppedAt || a.updatedAt };
  if (!recent(a.updatedAt, ASSIST_LOCATION_QUIET_MS, now)) return { state: 'off', name, at: a.updatedAt, quiet: true };
  if (trip.locationSource === 'assistant') return { state: 'covering', name, at: a.updatedAt };
  if (trip.assistantOnBus === false) return { state: 'not_on_bus', name, at: a.updatedAt };
  return { state: 'standby', name, at: a.updatedAt };
}
