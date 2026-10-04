// Developer tools for the superadmin "System" page: health, messaging and errors.
import { voiceProviderStatus } from '../services/voice/index.js';
import asyncHandler from 'express-async-handler';
import AppCrash from '../models/AppCrash.js';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import MessageLog from '../models/MessageLog.js';
import School from '../models/School.js';
import {
  MESSAGE_PURPOSES,
  messagePurposes,
  sendSms,
  smsBalance,
  smsProviderStatus,
  emailProviderStatus,
} from '../services/messaging/index.js';
import { sweeperStatus, STALE_TRIP_HOURS } from '../services/staleTrips.js';
import { simulatorStatus } from '../sockets/tripSimulator.js';
import { recentErrors, clearErrors } from '../utils/errorLog.js';
import { normalizeGhanaPhone, isValidGhanaPhone } from '../utils/phone.js';
import { tenantContext } from '../utils/tenantContext.js';

const startedAt = new Date();
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// Settings the server reads. Only whether each is set is reported, never its value.
const CONFIG = [
  { key: 'MONGO_URI', group: 'Core', required: true, note: 'Database connection' },
  { key: 'JWT_SECRET', group: 'Core', required: true, note: 'Signs sign-in tokens' },
  { key: 'JWT_EXPIRES_IN', group: 'Core', note: 'Sign-in lifetime (default 7d)' },
  { key: 'NODE_ENV', group: 'Core', note: 'Set to "production" on the live server (hides error details)' },
  { key: 'PORT', group: 'Core', note: 'Set by the host' },
  { key: 'CLIENT_URL', group: 'Web access (CORS)', note: 'Admin site address allowed to call the API' },
  { key: 'DEPLOYED_URL', group: 'Web access (CORS)', note: 'Deployed admin site address' },
  { key: 'ASSIST_APP_URL', group: 'Web access (CORS)', note: 'Optional: admin site address in the bus assistant QR code (otherwise DEPLOYED_URL)' },
  { key: 'CODESPACE_URL', group: 'Web access (CORS)', note: 'Codespace admin site address (development)' },
  { key: 'SMS_PROVIDER', group: 'SMS (Arkesel)', note: 'Set to "arkesel" to send real SMS' },
  { key: 'ARKESEL_API_KEY', group: 'SMS (Arkesel)', note: 'From the Arkesel dashboard' },
  { key: 'ARKESEL_SENDER_ID', group: 'SMS (Arkesel)', note: 'Approved sender name, max 11 characters' },
  { key: 'ARKESEL_SANDBOX', group: 'SMS (Arkesel)', note: '"true" = test mode, messages are not delivered or charged' },
  { key: 'VOICE_PROVIDER', group: 'Arrival calls (Arkesel voice)', note: 'Set to "arkesel" to call parents when the bus is near home (a text is sent if not picked up)' },
  { key: 'ARKESEL_VOICE_FILE_URL', group: 'Arrival calls (Arkesel voice)', note: 'Public URL of the recorded message parents hear (fetched and re-uploaded to Arkesel on each call)' },
  { key: 'ARKESEL_VOICE_ID', group: 'Arrival calls (Arkesel voice)', note: 'Caller-ID number shown to parents when they receive the call' },
  { key: 'VOICE_WEBHOOK_TOKEN', group: 'Arrival calls (Arkesel voice)', note: 'Secret in the call-result webhook address: /api/webhooks/voice?token=...' },
  { key: 'SERVER_PUBLIC_URL', group: 'Arrival calls (Arkesel voice)', note: 'This server\'s public address (for the webhook)' },
  { key: 'OTP_EXPIRES_MINUTES', group: 'Other', note: 'How long codes last (default 10)' },
  { key: 'LOG_OTP_CODES', group: 'Other', note: '"false" stops printing unsent codes in the server log' },
  { key: 'TRIP_SIMULATOR', group: 'Other', note: '"true" turns on the demo GPS simulator (never on a live system)' },
  { key: 'GHANAPOSTGPS_API_URL', group: 'Other', note: 'GhanaPostGPS lookup service' },
];

// @desc    Server, database, jobs, integrations and settings at a glance
// @route   GET /api/superadmin/system/health
export const getHealth = asyncHandler(async (req, res) => {
  const db = mongoose.connection;
  let pingMs = null;
  let pingError = null;
  try {
    const t = Date.now();
    await db.db.admin().ping();
    pingMs = Date.now() - t;
  } catch (err) {
    pingError = err.message;
  }
  const io = req.app.get('io');
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [messages24h, failed24h, appCrashes] = await Promise.all([
    MessageLog.countDocuments({ createdAt: { $gte: since24h } }),
    MessageLog.countDocuments({ createdAt: { $gte: since24h }, status: 'failed' }),
    // Driver app crashes reported by phones (last 30 days), newest first.
    AppCrash.find().sort({ createdAt: -1 }).limit(10).populate('driver', 'firstName lastName').lean(),
  ]);
  const errors = recentErrors();

  res.json({
    success: true,
    data: {
      server: {
        version: pkg.version,
        commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null,
        branch: process.env.RENDER_GIT_BRANCH || null,
        node: process.version,
        env: process.env.NODE_ENV || 'development',
        startedAt,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      database: { state: DB_STATES[db.readyState] || 'unknown', name: db.name, pingMs, pingError },
      realtime: { connectedClients: io?.engine?.clientsCount ?? 0 },
      jobs: {
        staleTrips: { ...sweeperStatus, hours: STALE_TRIP_HOURS },
        simulator: simulatorStatus,
      },
      messaging: {
        sms: { ...smsProviderStatus(), balance: await smsBalance() },
        email: emailProviderStatus(),
        voice: voiceProviderStatus(),
        last24h: { total: messages24h, failed: failed24h },
      },
      errors: { sinceStart: errors.total, latest: errors.entries[0] || null },
      appCrashes: appCrashes.map((c) => ({
        at: c.happenedAt || c.createdAt,
        driver: c.driver ? `${c.driver.firstName} ${c.driver.lastName}` : '',
        message: c.message,
        stack: c.stack,
        native: c.native,
        code: c.code,
      })),
      config: CONFIG.map((c) => ({ ...c, set: Boolean(process.env[c.key]) })),
    },
  });
});

// @desc    Recorded SMS/emails, newest first
// @route   GET /api/superadmin/system/messages?channel=sms&status=failed&purpose=...&page=1
export const getMessages = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = 25;
  const filter = {};
  if (['sms', 'email'].includes(req.query.channel)) filter.channel = req.query.channel;
  if (['logged', 'sent', 'failed'].includes(req.query.status)) filter.status = req.query.status;
  if (MESSAGE_PURPOSES[req.query.purpose]) filter.purpose = req.query.purpose;

  const [items, total, schools] = await Promise.all([
    MessageLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    MessageLog.countDocuments(filter),
    tenantContext.runAsSystem(() => School.find({}).select('name').lean()),
  ]);
  const names = new Map(schools.map((s) => [String(s._id), s.name]));
  res.json({
    success: true,
    data: items.map((m) => ({ ...m, schoolName: m.school ? names.get(String(m.school)) || '' : '' })),
    meta: { total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) },
    purposes: messagePurposes(),
  });
});

// @desc    Send a test SMS through the current provider
// @route   POST /api/superadmin/system/messages/test   body: { to, text }
export const sendTestSms = asyncHandler(async (req, res) => {
  const to = normalizeGhanaPhone(req.body?.to);
  if (!to || !isValidGhanaPhone(to)) {
    res.status(400);
    throw new Error('Enter a Ghana phone number, e.g. 024 412 3456');
  }
  const text = String(req.body?.text || '').trim() || 'AwaBus test message. If you received this, SMS sending works.';
  if (text.length > 320) {
    res.status(400);
    throw new Error('Keep the test message under 320 characters (2 SMS)');
  }
  const result = await sendSms({ to, text, purpose: 'test' });
  res.json({ success: true, data: { ...result, provider: smsProviderStatus().provider } });
});

// @desc    Recent server errors (since the last restart)
// @route   GET /api/superadmin/system/errors
export const getErrors = asyncHandler(async (req, res) => {
  res.json({ success: true, data: recentErrors() });
});

// @route   DELETE /api/superadmin/system/errors
export const deleteErrors = asyncHandler(async (req, res) => {
  clearErrors();
  res.json({ success: true });
});
