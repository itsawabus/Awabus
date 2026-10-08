// Bus assistant pass: lets the teacher on bus duty help the driver from their
// own phone. The driver app shows a QR code (a link with a random pass); the
// link opens the assistant page on the admin website, no account needed.
//
// - One pass per trip; making a new one cancels the old one.
// - It works while that trip is running (Scheduled / In Progress / Delayed)
//   and, when that trip ends (the driver ended it, or AwaBus closed it), it
//   follows the same driver to their next trip today, until PASS_HOURS pass or
//   the driver stops sharing / makes a new code. Between trips the page just
//   waits.
// - Only a SHA-256 hash of the pass is stored.
import crypto from 'node:crypto';
import Trip from '../models/Trip.js';
import { tenantContext } from '../utils/tenantContext.js';

export const PASS_HOURS = 12;
const OPEN = ['Scheduled', 'In Progress', 'Delayed'];
const NO_PASS = { hash: '', createdAt: null, expiresAt: null };

// A bus assistant counts as connected while their page reached AwaBus this recently.
export const ASSIST_CONNECTED_MS = 45 * 1000;

/** The trip's assistants with connected true / false (and the pass still working). */
export function assistantsWithStatus(trip, now = Date.now()) {
  const p = trip.assistPass || {};
  const passWorks = Boolean(p.hash) && ['Scheduled', 'In Progress', 'Delayed'].includes(trip.status) && (!p.expiresAt || new Date(p.expiresAt) > new Date(now));
  return (trip.assistants || []).map((a) => ({
    name: a.name,
    firstSeenAt: a.firstSeenAt,
    lastSeenAt: a.lastSeenAt || a.firstSeenAt,
    connected: passWorks && Boolean(a.lastSeenAt || a.firstSeenAt) && now - new Date(a.lastSeenAt || a.firstSeenAt).getTime() < ASSIST_CONNECTED_MS,
  }));
}

const hashOf = (pass) => crypto.createHash('sha256').update(String(pass)).digest('hex');

// Where the assistant page lives (the admin website), as phones must open it:
// ASSIST_APP_URL if set; otherwise the deployed admin site (DEPLOYED_URL, the
// same address allowed to sign in); in a GitHub Codespace the admin dev
// server's forwarded address (port 5173); then CLIENT_URL / CODESPACE_URL.
// A localhost address is only used when nothing else is set: another phone
// can never open it.
const isLocal = (url) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url);
const clean = (url) => String(url || '').split(',')[0].trim().replace(/\/+$/, '');
export function assistBaseUrl() {
  if (process.env.ASSIST_APP_URL) return clean(process.env.ASSIST_APP_URL);
  const deployed = clean(process.env.DEPLOYED_URL);
  if (deployed && !isLocal(deployed)) return deployed;
  if (process.env.CODESPACE_NAME) {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
    return `https://${process.env.CODESPACE_NAME}-5173.${domain}`;
  }
  const candidates = [process.env.CLIENT_URL, process.env.CODESPACE_URL].map(clean).filter(Boolean);
  return candidates.find((u) => !isLocal(u)) || candidates[0] || 'http://localhost:5173';
}

/** Makes a new pass for a trip (cancelling any earlier one). Returns { url, qrSvg, expiresAt }. */
export async function createPass(trip) {
  const pass = crypto.randomBytes(24).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASS_HOURS * 60 * 60 * 1000);
  // One code per driver: a new one replaces the old one, also on the driver's earlier trips
  // (their links follow the driver, so they must not outlive a newer code).
  const owner = trip.driver || (await Trip.findById(trip._id).select('driver').lean())?.driver;
  if (owner) await Trip.updateMany({ driver: owner, _id: { $ne: trip._id }, 'assistPass.hash': { $ne: '' } }, { $set: { assistPass: NO_PASS } });
  await Trip.updateOne({ _id: trip._id }, { $set: { assistPass: { hash: hashOf(pass), createdAt: now, expiresAt } } });
  const url = `${assistBaseUrl()}/assist/${pass}`;
  // Where the QR opens (the admin site's address only, never the pass), to check it is the site people sign in to.
  console.log(`[assist] new pass for trip ${trip._id}; its QR opens ${assistBaseUrl()}/assist/... (DEPLOYED_URL ${process.env.DEPLOYED_URL ? 'is set' : 'is NOT set'}, ASSIST_APP_URL ${process.env.ASSIST_APP_URL ? 'is set' : 'is not set'})`);
  // Loaded only when a code is made, so the server still starts (and
  // everything else works) if "npm install" has not been run yet.
  let QRCode;
  try {
    QRCode = (await import('qrcode')).default;
  } catch {
    throw new Error('The QR code maker is not installed on the server. Run "npm install" in the server folder and restart it.');
  }
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { url, qrSvg, expiresAt };
}

/** Stops sharing: the trip's pass and any earlier pass of the same driver that would follow them. */
export async function revokePass(tripId) {
  const t = await Trip.findById(tripId).select('driver').lean();
  const filter = t?.driver ? { $or: [{ _id: tripId }, { driver: t.driver, 'assistPass.hash': { $ne: '' } }] } : { _id: tripId };
  return Trip.updateMany(filter, { $set: { assistPass: NO_PASS } });
}

/**
 * Finds the trip for a pass. Returns { trip } when it is usable, or
 * { error, status, code } when it is unknown, replaced, expired or the trip ended.
 */
export async function resolvePass(pass) {
  if (!pass || String(pass).length < 20) return { error: 'This bus assistant link is not valid.', status: 401, code: 'ASSIST_INVALID' };
  let trip = await tenantContext.runAsSystem(() =>
    Trip.findOne({ 'assistPass.hash': hashOf(pass) }).select('_id tripCode school driver status autoEnded createdAt assistPass assistants')
  );
  if (!trip) {
    return { error: 'This link no longer works. The driver may have made a newer QR code (each new code replaces the old one) or stopped sharing the trip. Ask the driver to show the current QR code.', status: 401, code: 'ASSIST_INVALID' };
  }
  if (trip.assistPass?.expiresAt && Date.now() > new Date(trip.assistPass.expiresAt).getTime()) {
    return { error: 'This link has expired. Ask the driver to show a new QR code.', status: 410, code: 'ASSIST_EXPIRED' };
  }
  if (!OPEN.includes(trip.status)) {
    const ended = trip;
    trip = await followDriver(trip);
    if (!trip) {
      // Which trip the link belongs to, so "it hasn't ended" can be checked against the trip that is running.
      console.log(`[assist] link is for trip ${ended.tripCode} (${ended.status}), which is not running`);
      return {
        error: `This trip has ended. This page will pick up the driver's next trip by itself once it starts (link is for trip ${ended.tripCode}, ${ended.status.toLowerCase()}).`,
        status: 410,
        code: 'ASSIST_ENDED',
      };
    }
  }
  return { trip };
}

/**
 * The trip the pass was made for is over (the driver ended it, it was replaced
 * by a fresh run, or AwaBus ended it). The bus is still with the same driver, so
 * the teacher's link moves to the driver's current trip today, unless the driver
 * already made a new code for it. With no next trip yet, the link waits.
 */
async function followDriver(old) {
  return tenantContext.run(String(old.school), async () => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const next = await Trip.findOne({
      _id: { $ne: old._id },
      driver: old.driver,
      date: { $gte: dayStart },
      status: { $in: OPEN },
      createdAt: { $gt: old.createdAt },
    })
      .sort({ createdAt: -1 })
      .select('_id school driver status autoEnded createdAt assistPass assistants');
    if (!next || next.assistPass?.hash) return null;
    // Only one request moves it (the pass must still be on the old trip).
    const moved = await Trip.updateOne({ _id: old._id, 'assistPass.hash': old.assistPass.hash }, { $set: { assistPass: { hash: '', createdAt: null, expiresAt: null } } });
    if (!moved.modifiedCount) return Trip.findOne({ 'assistPass.hash': old.assistPass.hash }).select('_id school driver status assistPass');
    await Trip.updateOne(
      { _id: next._id },
      { $set: { assistPass: { hash: old.assistPass.hash, createdAt: old.assistPass.createdAt, expiresAt: old.assistPass.expiresAt }, assistants: old.assistants || [] } }
    );
    return Trip.findById(next._id).select('_id school driver status assistPass');
  });
}

/** Moves a trip's still-working pass to the trip that replaced it (see followDriver). */
export async function carryPass(oldTripId) {
  const old = await Trip.findById(oldTripId).select('_id school driver status autoEnded createdAt assistPass assistants');
  if (!old?.assistPass?.hash) return;
  if (old.assistPass.expiresAt && Date.now() > new Date(old.assistPass.expiresAt).getTime()) return;
  await followDriver(old);
}
