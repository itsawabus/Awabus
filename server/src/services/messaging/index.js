// One place every outgoing SMS and email goes through. Each message is recorded
// in MessageLog (codes hidden) so developers can see what the platform sends.
// Until a provider is switched on, messages are only written to the server log.
import MessageLog from '../../models/MessageLog.js';
import { arkeselSend, arkeselBalance } from './arkesel.js';

// Where messages are fired from. `wired: false` = planned, not built yet.
export const MESSAGE_PURPOSES = {
  driver_password_reset: { channel: 'sms', label: 'Driver password reset code', where: 'Driver app > Forgot password', wired: true },
  account_verification: { channel: 'sms / email', label: 'Admin account verification code', where: 'Account settings (change phone, email or password)', wired: true },
  admin_password_reset: { channel: 'email', label: 'Admin password reset code', where: 'Admin sign-in > Forgot password', wired: true },
  delay_broadcast: { channel: 'sms', label: 'Delay notice to parents', where: 'Driver app > Report delay', wired: true },
  parent_message: { channel: 'sms', label: 'Message from the bus to one parent', where: 'Driver app > student list > message button', wired: true },
  test: { channel: 'sms', label: 'Test message', where: 'System page > Send test SMS', wired: true },
  boarding_alert: { channel: 'sms', label: 'Child boarded / dropped off alert to parents', where: 'Driver app scan (on unless PARENT_ALERTS=false)', wired: true, switch: 'PARENT_ALERTS' },
  approaching_call: { channel: 'voice', label: 'Bus near home call to parents (a missed call is the alert, no text follows)', where: 'Live GPS vs the student\'s notification zone (on unless PARENT_ALERTS=false; needs VOICE_PROVIDER set)', wired: true, switch: 'PARENT_ALERTS' },
  approaching_alert: { channel: 'sms', label: 'Bus near home alert (geofence)', where: 'Live GPS vs the student\'s notification zone (on unless PARENT_ALERTS=false)', wired: true, switch: 'PARENT_ALERTS' },
};

// The purposes with `on` filled in: false for built messages switched off in the environment.
export const messagePurposes = () =>
  Object.fromEntries(
    Object.entries(MESSAGE_PURPOSES).map(([k, p]) => [k, { ...p, on: p.wired && (!p.switch || String(process.env[p.switch] || '').trim().toLowerCase() !== 'false') }])
  );

export function smsProviderStatus() {
  const wanted = (process.env.SMS_PROVIDER || '').toLowerCase();
  const keys = Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID);
  if (wanted === 'arkesel' && keys) {
    return { provider: 'arkesel', live: true, sandbox: process.env.ARKESEL_SANDBOX === 'true', sender: process.env.ARKESEL_SENDER_ID };
  }
  return {
    provider: 'log',
    live: false,
    reason: wanted === 'arkesel' ? 'SMS_PROVIDER=arkesel but ARKESEL_API_KEY or ARKESEL_SENDER_ID is missing' : 'No SMS provider switched on (set SMS_PROVIDER=arkesel)',
  };
}

export const emailProviderStatus = () => ({ provider: 'log', live: false, reason: 'No email provider has been built yet' });

// Hide one-time codes in anything stored or shown.
const hideCodes = (text) => String(text || '').replace(/\b\d{4,8}\b/g, (m) => '•'.repeat(m.length));

async function record(entry) {
  try {
    await MessageLog.create(entry);
  } catch (err) {
    console.error('[messaging] could not record message:', err.message);
  }
}

/**
 * Send an SMS. Never throws: returns { status: 'sent' | 'logged' | 'failed', error? }.
 * `secret: true` marks messages that contain a one-time code.
 */
export async function sendSms({ to, text, purpose, school = null, secret = false }) {
  const started = Date.now();
  const status = smsProviderStatus();
  const stored = secret ? hideCodes(text) : text;
  if (!status.live) {
    // No provider yet: written to the server log only. (Codes are printed by
    // utils/otp.js in the old "[otp] Verification code for ..." format.)
    console.log(`[sms] (not sent, no SMS provider) ${purpose} to ${to}: ${secret ? hideCodes(text) : text}`);
    await record({ channel: 'sms', purpose, to, body: stored, provider: 'log', status: 'logged', school });
    return { status: 'logged' };
  }
  try {
    const { providerMessageId } = await arkeselSend(to, text);
    await record({ channel: 'sms', purpose, to, body: stored, provider: 'arkesel', status: 'sent', providerMessageId, durationMs: Date.now() - started, school });
    return { status: 'sent', providerMessageId };
  } catch (err) {
    console.error(`[sms] Arkesel send failed (${purpose}):`, err.message);
    await record({ channel: 'sms', purpose, to, body: stored, provider: 'arkesel', status: 'failed', error: err.message, durationMs: Date.now() - started, school });
    return { status: 'failed', error: err.message };
  }
}

/** Send an email. No provider yet, so it is logged only. */
export async function sendEmail({ to, subject, text, purpose, school = null, secret = false }) {
  console.log(`[email] (not sent, no email provider) ${purpose} to ${to}: ${subject} - ${secret ? hideCodes(text) : text}`);
  await record({ channel: 'email', purpose, to, body: secret ? hideCodes(text) : text, provider: 'log', status: 'logged', school });
  return { status: 'logged' };
}

let balanceCache = { at: 0, value: null };
/** SMS credit left (Arkesel only), cached for a minute. */
export async function smsBalance() {
  if (!smsProviderStatus().live) return null;
  if (Date.now() - balanceCache.at < 60000) return balanceCache.value;
  try {
    balanceCache = { at: Date.now(), value: { ok: true, ...(await arkeselBalance()) } };
  } catch (err) {
    balanceCache = { at: Date.now(), value: { ok: false, error: err.message } };
  }
  return balanceCache.value;
}
