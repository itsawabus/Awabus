// Phone calls to parents (the "bus is near home" arrival call), with the
// result of each call (ringing, answered, not picked up...) shown on the
// student's card in the driver app and on the bus assistant page.
//
// Off until a voice provider is switched on: VOICE_PROVIDER=arkesel plus the
// Arkesel voice settings in .env (see .env.example). Until then the arrival
// alert stays a text message, exactly as before.
//
// How a call's result comes back: the provider calls our webhook
// (POST /api/webhooks/voice?token=VOICE_WEBHOOK_TOKEN, routes/webhookRoutes.js)
// each time the call changes (ringing, answered, ended...). The webhook finds
// the trip row by the call id and updates it (updateCallResult below).
import { arkeselCall } from './arkeselVoice.js';

// What the driver / assistant sees for each call state.
export const CALL_LABELS = {
  calling: 'Calling parent…',
  ringing: 'Ringing',
  answered: 'Answered',
  cut: 'Call cut',
  declined: 'Declined / busy',
  no_answer: 'Not picked up',
  failed: "Didn't go through",
};
export const FINAL_CALL_STATES = ['answered', 'cut', 'declined', 'no_answer', 'failed'];
// Answered, but hung up within this many seconds: shown as "Call cut".
export const CUT_UNDER_SECONDS = 5;

export function voiceProviderStatus() {
  const wanted = (process.env.VOICE_PROVIDER || '').toLowerCase();
  if (wanted === 'arkesel') {
    const missing = ['ARKESEL_API_KEY', 'ARKESEL_VOICE_FILE_URL', 'ARKESEL_VOICE_ID', 'VOICE_WEBHOOK_TOKEN'].filter(
      (k) => !process.env[k]
    );
    if (!missing.length) return { provider: 'arkesel', live: true };
    return { provider: 'none', live: false, reason: `VOICE_PROVIDER=arkesel but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing` };
  }
  // For automated tests only: calls are "placed" without dialling anyone, and
  // results are posted to the webhook by the test.
  if (wanted === 'mock') return { provider: 'mock', live: true };
  return { provider: 'none', live: false, reason: 'No voice provider switched on (set VOICE_PROVIDER=arkesel)' };
}

export const voiceLive = () => voiceProviderStatus().live;

/**
 * Starts a call. Never throws: returns { status: 'calling', callId } or
 * { status: 'failed', error } (or 'off' when no provider is switched on).
 */
export async function placeCall({ to, purpose }) {
  const provider = voiceProviderStatus();
  if (!provider.live) return { status: 'off' };
  if (!to) return { status: 'failed', error: 'No phone number' };
  try {
    if (provider.provider === 'mock') return { status: 'calling', callId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    const { callId } = await arkeselCall(to);
    console.log(`[voice] ${purpose} call to ${to} placed (${callId})`);
    return { status: 'calling', callId };
  } catch (err) {
    console.error(`[voice] ${purpose} call failed:`, err.message);
    return { status: 'failed', error: err.message };
  }
}

/**
 * A provider's status words -> our call state. Providers word these
 * differently, so this accepts the common spellings.
 */
export function normalizeCallStatus(raw, seconds) {
  const s = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_');
  const secs = Number(seconds);
  if (['queued', 'initiated', 'initiating', 'calling', 'dialing', 'dialling', 'pending', 'sent', 'submitted'].includes(s)) return 'calling';
  if (['ringing', 'ring', 'alerting', 'in_progress_ringing'].includes(s)) return 'ringing';
  if (['busy', 'rejected', 'declined', 'user_busy', 'call_rejected'].includes(s)) return 'declined';
  if (['no_answer', 'noanswer', 'not_answered', 'unanswered', 'missed', 'timeout', 'no_response'].includes(s)) return 'no_answer';
  if (['failed', 'undelivered', 'error', 'invalid', 'invalid_number', 'unreachable', 'switched_off', 'canceled', 'cancelled'].includes(s)) return 'failed';
  if (['answered', 'in_progress', 'inprogress', 'connected', 'active', 'picked_up'].includes(s)) return 'answered';
  if (['completed', 'complete', 'delivered', 'success', 'successful', 'hangup', 'hung_up', 'ended', 'finished'].includes(s)) {
    if (Number.isFinite(secs) && secs < CUT_UNDER_SECONDS) return secs <= 0 ? 'no_answer' : 'cut';
    return 'answered';
  }
  return null; // unknown word: ignore rather than guess
}

/**
 * Should `next` replace `current`? Calls only move forward (a late "ringing"
 * never undoes "answered"); an answered call can still become "cut" once its
 * length is known.
 */
export function callMovesTo(current, next) {
  if (!next) return false;
  if (!current) return true;
  if (current === next) return next === 'answered'; // duration may have arrived
  if (current === 'answered') return next === 'cut';
  if (FINAL_CALL_STATES.includes(current)) return false;
  if (current === 'ringing') return next !== 'calling';
  return true; // calling -> anything
}

/** Pulls the call id, status and length out of a provider's webhook body. */
export function readWebhook(body = {}) {
  const b = { ...(body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}), ...body };
  const callId = String(b.call_id || b.callId || b.id || b.session_id || b.sessionId || b.message_id || '').trim();
  const status = b.status || b.call_status || b.callStatus || b.state || '';
  const seconds = b.duration ?? b.call_duration ?? b.callDuration ?? b.seconds ?? null;
  return { callId, status, seconds: seconds === null || seconds === '' ? null : Number(seconds) };
}
