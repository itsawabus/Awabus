// Bus assistant pass: lets the teacher on bus duty help the driver from their
// own phone. The driver app shows a QR code (a link with a random pass); the
// link opens the assistant page on the admin website, no account needed.
//
// - One pass per trip; making a new one cancels the old one.
// - It works only while that trip has not ended (Scheduled / In Progress /
//   Delayed), and never longer than PASS_HOURS.
// - Only a SHA-256 hash of the pass is stored.
import crypto from 'node:crypto';
import Trip from '../models/Trip.js';
import { tenantContext } from '../utils/tenantContext.js';

export const PASS_HOURS = 12;
const OPEN = ['Scheduled', 'In Progress', 'Delayed'];

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
  await Trip.updateOne({ _id: trip._id }, { $set: { assistPass: { hash: hashOf(pass), createdAt: now, expiresAt } } });
  const url = `${assistBaseUrl()}/assist/${pass}`;
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

/** Stops the current pass for a trip. */
export const revokePass = (tripId) =>
  Trip.updateOne({ _id: tripId }, { $set: { assistPass: { hash: '', createdAt: null, expiresAt: null } } });

/**
 * Finds the trip for a pass. Returns { trip } when it is usable, or
 * { error, status, code } when it is unknown, replaced, expired or the trip ended.
 */
export async function resolvePass(pass) {
  if (!pass || String(pass).length < 20) return { error: 'This bus assistant link is not valid.', status: 401, code: 'ASSIST_INVALID' };
  const trip = await tenantContext.runAsSystem(() =>
    Trip.findOne({ 'assistPass.hash': hashOf(pass) }).select('_id school driver status assistPass')
  );
  if (!trip) {
    return { error: 'This link no longer works. Ask the driver to show the QR code again.', status: 401, code: 'ASSIST_INVALID' };
  }
  if (!OPEN.includes(trip.status)) return { error: 'This trip has ended, so this link no longer works.', status: 410, code: 'ASSIST_ENDED' };
  if (trip.assistPass?.expiresAt && Date.now() > new Date(trip.assistPass.expiresAt).getTime()) {
    return { error: 'This link has expired. Ask the driver to show a new QR code.', status: 410, code: 'ASSIST_EXPIRED' };
  }
  return { trip };
}
