// Bus assistant pass: lets the teacher on bus duty help the driver from their
// own phone. The driver app shows a QR code (a link with a random pass); the
// link opens the assistant page on the admin website, no account needed.
//
// - One pass per trip; making a new one cancels the old one.
// - It works only while that trip has not ended (Scheduled / In Progress /
//   Delayed), and never longer than PASS_HOURS.
// - Only a SHA-256 hash of the pass is stored.
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import Trip from '../models/Trip.js';
import { tenantContext } from '../utils/tenantContext.js';

export const PASS_HOURS = 12;
const OPEN = ['Scheduled', 'In Progress', 'Delayed'];

const hashOf = (pass) => crypto.createHash('sha256').update(String(pass)).digest('hex');

// Where the assistant page lives (the admin website). ASSIST_APP_URL wins; in a
// GitHub Codespace the admin dev server's forwarded address (port 5173);
// otherwise CLIENT_URL.
export function assistBaseUrl() {
  if (process.env.ASSIST_APP_URL) return process.env.ASSIST_APP_URL.replace(/\/+$/, '');
  if (process.env.CODESPACE_NAME) {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
    return `https://${process.env.CODESPACE_NAME}-5173.${domain}`;
  }
  return String(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
}

/** Makes a new pass for a trip (cancelling any earlier one). Returns { url, qrSvg, expiresAt }. */
export async function createPass(trip) {
  const pass = crypto.randomBytes(24).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASS_HOURS * 60 * 60 * 1000);
  await Trip.updateOne({ _id: trip._id }, { $set: { assistPass: { hash: hashOf(pass), createdAt: now, expiresAt } } });
  const url = `${assistBaseUrl()}/assist/${pass}`;
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
